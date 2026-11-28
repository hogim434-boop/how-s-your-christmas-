"use client";

// "함께 걷기"의 실시간 연결을 맡는 부품(훅)입니다. (Task 025-5)
// 같은 마을에 접속한 주민끼리 "누가 접속해 있는지"와 "어디로 걸어가는지"를 주고받아,
// 다른 주민 보관함(remoteStore.ts)에 넣습니다. 그리기는 RemotePlayers.tsx가 그 보관함을 읽어서 합니다.
//
// 💡 쓰는 것: Supabase Realtime (브라우저와 서버가 계속 이어져 있는 통로 = WebSocket)
//    - 채널: 마을마다 하나. 이름은 "village:<마을 번호>"이고, 그 마을 주민만 들어올 수 있습니다 (마이그레이션 07)
//    - Presence(접속 상태): "지금 누가 이 채널에 있는지" 목록. 접속 여부만 알립니다
//    - Broadcast(방송): 채널에 있는 모두에게 보내는 짧은 메시지. 걸어갈 목표를 여기에 실어 보냅니다
// 💡 아끼는 규칙 (무료 한도: 프로젝트 전체 초당 100개)
//    - 자리를 계속 보내지 않고, 땅을 눌러 목표가 생길 때만 보냅니다
//    - 혼자 접속해 있으면 아무것도 보내지 않습니다
//    - 사람이 많을수록 내 방송 간격을 넓힙니다 (liveProtocol.ts의 sendIntervalMs)
// 💡 실패해도 조용히: 연결이 안 되면 다른 주민이 안 보일 뿐, 걷기·편지는 그대로 됩니다. 오류는 console에만 남깁니다.
// 💡 연결을 쉬는 때 (Task 025-6): 화면을 10초 넘게 안 보고 있거나(다른 앱·다른 탭), 인터넷이 끊기면 연결을 닫습니다.
//    다시 보거나 인터넷이 돌아오면 새로 잇고, 그때 접속해 있는 주민들이 지금 자리를 다시 알려 줍니다.
//    (닫아 두면 무료 한도의 "동시 연결 수"를 아끼고, 다른 사람 화면에서 내가 유령처럼 남지 않습니다)

import { useEffect, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_REMOTE_AVATARS,
  MOVE_EVENT,
  PROGRESS_EVENT,
  PROGRESS_REFRESH_MS,
  clampToBounds,
  diffKeys,
  joinReplyWindowMs,
  nearestIds,
  parseMove,
  sendIntervalMs,
  spawnPoint,
  villageTopic,
} from "./liveProtocol";
import type { OnlineStore } from "./onlineStore";
import type { RemoteMove, RemoteStore } from "./remoteStore";
import type { WalkStore } from "./walkStore";

/** 채널 참가가 거부·시간 초과됐을 때 다시 시도하기까지 기다리는 시간(밀리초). 처음 세 번은 점점 길게 */
const RETRY_DELAYS_MS = [2000, 5000, 12000];
/** 세 번 다 실패한 뒤에는 이 간격으로 천천히 다시 시도합니다 (화면을 보고 있고 인터넷이 될 때만) */
const SLOW_RETRY_MS = 30000;
/** "모르는 주민이 보낸 방송"이 와도 마을 정보를 다시 읽는 것은 이 간격에 한 번만 */
const UNKNOWN_REFRESH_MS = 10000;
/** 화면을 안 보기 시작한 뒤 이만큼 지나면 연결을 닫습니다 (잠깐 다른 탭을 본 정도로는 끊지 않음) */
const HIDDEN_DISCONNECT_MS = 10000;
/** 접속자가 상한(MAX_REMOTE_AVATARS)을 넘을 때, 내가 걸어 다니는 것에 맞춰 "가까운 사람들"을 다시 고르는 간격 */
const REPICK_MS = 1000;
/** 내 캐릭터가 화면에 그려지기를 기다리며 확인하는 간격 */
const READY_POLL_MS = 300;

interface LiveWalkOptions {
  /** false면 아무것도 하지 않습니다 (연결도 열지 않음) */
  enabled: boolean;
  villageId: string;
  /** 내 사용자 번호 */
  myId: string | undefined;
  /** 이 마을 주민의 사용자 번호 목록 (화면에 집이 그려진 사람들) */
  residentIds: readonly string[];
  /** 마을 경계 반지름 (받은 자리가 마을 안인지 확인) */
  boundsRadius: number;
  /** 내 캐릭터의 목표·자리 보관함 */
  walkStore: WalkStore;
  /** 다른 주민 보관함 (여기에 넣으면 3D가 그립니다) */
  remoteStore: RemoteStore;
  /** 접속 중인 주민 목록 보관함 (집 이름표의 "접속 중" 점에 씁니다) */
  onlineStore: OnlineStore;
  /** 화면이 아직 모르는 주민의 방송이 왔을 때 (방금 입주한 사람) → 마을 정보를 다시 읽게 합니다 */
  onUnknownResident: () => void;
  /** 다른 주민이 편지를 쓰거나 지웠다는 알림이 왔을 때 → 진행 숫자를 다시 읽게 합니다 */
  onProgressChanged: () => void;
}

/** 이 훅이 화면(VillageView)에 돌려주는 것 */
export interface LiveWalkHandle {
  /** 내가 편지를 쓰거나 지운 뒤 부릅니다: 같은 마을에 접속한 사람들에게 "진행률이 바뀌었어요"라고 알립니다 */
  announceProgress: () => void;
  /** 실시간 통로가 지금 이어져 있는지 */
  isConnected: () => boolean;
}

/** 소수 둘째 자리까지만 보냅니다 (1cm 단위면 충분하고, 메시지가 작아집니다) */
const round2 = (n: number) => Math.round(n * 100) / 100;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useLiveWalk({
  enabled,
  villageId,
  myId,
  residentIds,
  boundsRadius,
  walkStore,
  remoteStore,
  onlineStore,
  onUnknownResident,
  onProgressChanged,
}: LiveWalkOptions): LiveWalkHandle {
  // 자주 바뀌는 값들은 "상자(ref)"에 담아 둡니다. 이 값이 바뀔 때마다 연결을 끊고 다시 맺지 않기 위해서입니다
  const residentSet = useRef<ReadonlySet<string>>(new Set());
  const unknownHandler = useRef(onUnknownResident);
  const progressHandler = useRef(onProgressChanged);
  const bounds = useRef(boundsRadius);
  // 연결돼 있는 동안에만 들어 있는 "바깥에서 부를 수 있는 기능" (아래에서 돌려주는 함수들이 이 상자를 봅니다)
  const live = useRef<{ sendProgress: () => void; isSubscribed: () => boolean } | null>(null);
  // 주민 목록이 바뀌면(새 주민의 집이 그려지면) 보여 줄 사람을 다시 고르는 함수. 연결돼 있을 때만 들어 있습니다
  const reconcile = useRef<(() => void) | null>(null);
  useEffect(() => {
    residentSet.current = new Set(residentIds);
    unknownHandler.current = onUnknownResident;
    progressHandler.current = onProgressChanged;
    bounds.current = boundsRadius;
    reconcile.current?.();
  }, [residentIds, onUnknownResident, onProgressChanged, boundsRadius]);

  useEffect(() => {
    if (!enabled || !myId) return;
    const supabase = createClient();
    const topic = villageTopic(villageId);

    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let subscribed = false;
    /** 한 번이라도 이어진 적이 있는지 (다시 이어졌을 때 그 사이 바뀐 진행률을 따라잡는 데 씁니다) */
    let everSubscribed = false;
    /** 연결을 준비하는 중인지 (로그인 정보 싣기·내 캐릭터 기다리기). 이때 또 연결을 시작하지 않습니다 */
    let connecting = false;
    /** 연결을 끊을 때마다 1씩 늘립니다. 끊기 전에 시작한 준비 작업이 뒤늦게 채널을 만들지 않게 하는 표시 */
    let generation = 0;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let sendTimer: ReturnType<typeof setTimeout> | undefined;
    let replyTimer: ReturnType<typeof setTimeout> | undefined;
    let progressTimer: ReturnType<typeof setTimeout> | undefined;
    let lastProgressAt = 0;
    let lastSentAt = 0;
    let lastUnknownAt = 0;
    /** 지금 채널에 있는 사람들의 사용자 번호 (나 포함) */
    let present: string[] = [];
    /** 다른 사람들의 접속 하나하나(탭 하나 = 하나)를 가리키는 표시들. 같은 사람이 탭을 하나 더 열었는지 알아채는 데 씁니다 */
    let presentRefs = new Set<string>();
    /** 방송을 받아 알고 있는 다른 주민들의 마지막 소식 (상한 때문에 그리지 않는 사람도 여기에는 있습니다) */
    const known = new Map<string, RemoteMove>();

    const myPoint = () => walkStore.getPos() ?? spawnPoint(myId);
    /** 지금 연결을 열어 둬도 되는 때인지: 화면을 보고 있고, 브라우저가 "인터넷 끊김"이라고 하지 않을 때 */
    const mayConnect = () => document.visibilityState === "visible" && navigator.onLine !== false;

    /** 알고 있는 주민 가운데 화면에 그릴 사람을 골라 보관함과 맞춥니다. fresh = 방금 소식이 온 사람 */
    const syncStore = (fresh?: string) => {
      const candidates: { id: string; x: number; z: number }[] = [];
      for (const [id, move] of known) {
        // 집이 그려진 주민만 그립니다 (이름표에 쓸 이름을 알아야 하므로). 거리는 그 사람의 목표 자리로 잽니다
        if (residentSet.current.has(id)) candidates.push({ id, x: move.tx, z: move.tz });
      }
      const drawn = new Set(remoteStore.getIds());
      // 이미 그리고 있는 사람에게는 여유 거리를 줘서, 경계에 걸린 사람이 나타났다 사라졌다 하지 않게 합니다
      const shown = new Set(nearestIds(myPoint(), candidates, MAX_REMOTE_AVATARS, drawn));
      for (const id of drawn) if (!shown.has(id)) remoteStore.remove(id);
      for (const id of shown) {
        const move = known.get(id);
        if (!move) continue;
        if (id === fresh) remoteStore.upsert(id, move);
        // 상한에 밀려 안 그리다가 다시 그리게 된 사람: 그동안 목표에 도착했을 테니 목표 자리에 세웁니다
        else if (!drawn.has(id)) remoteStore.upsert(id, { x: move.tx, z: move.tz, tx: move.tx, tz: move.tz });
      }
    };
    reconcile.current = () => syncStore();

    /** 화면이 아직 모르는 주민(방금 입주한 사람)을 봤을 때: 마을 정보를 다시 읽게 합니다 (너무 자주 부르지 않게 간격 제한) */
    const noteUnknown = () => {
      const now = Date.now();
      if (now - lastUnknownAt <= UNKNOWN_REFRESH_MS) return;
      lastUnknownAt = now;
      unknownHandler.current();
    };

    /** 내 지금 자리와 목표를 방송합니다. 혼자면 보내지 않습니다 */
    const sendNow = () => {
      if (!channel || !subscribed) return;
      if (present.every((key) => key === myId)) return;
      // 울타리 밖을 눌렀어도 경계 안의 값으로 보냅니다 (받는 쪽은 마을 밖 값을 버리기 때문)
      const pos = clampToBounds(myPoint(), bounds.current);
      const target = clampToBounds(walkStore.get() ?? pos, bounds.current);
      lastSentAt = Date.now();
      void channel
        .send({
          type: "broadcast",
          event: MOVE_EVENT,
          payload: { id: myId, x: round2(pos.x), z: round2(pos.z), tx: round2(target.x), tz: round2(target.z) },
        })
        .catch(() => {});
    };
    /**
     * 방송을 예약합니다. 마지막 방송에서 정해진 간격이 지나야 나가고,
     * 그 사이에 여러 번 불려도 한 번만(가장 마지막 값으로) 보냅니다.
     */
    const requestSend = () => {
      if (sendTimer !== undefined) return;
      const wait = Math.max(0, lastSentAt + sendIntervalMs(Math.max(1, present.length)) - Date.now());
      sendTimer = setTimeout(() => {
        sendTimer = undefined;
        sendNow();
      }, wait);
    };

    /** 내가 편지를 쓰거나 지웠다고 알립니다. 혼자면 보내지 않습니다 (숫자는 싣지 않고, 받은 쪽이 직접 다시 읽습니다) */
    const sendProgress = () => {
      if (!channel || !subscribed) return;
      if (present.every((key) => key === myId)) return;
      void channel.send({ type: "broadcast", event: PROGRESS_EVENT, payload: {} }).catch(() => {});
    };
    /**
     * 진행률이 바뀌었다는 알림을 받았을 때: 숫자를 다시 읽게 합니다.
     * 연달아 와도 정해진 간격에 한 번만 읽고, 기다리는 동안 온 알림은 그 한 번에 함께 반영됩니다.
     */
    const onProgress = () => {
      if (progressTimer !== undefined) return;
      const wait = Math.max(0, lastProgressAt + PROGRESS_REFRESH_MS - Date.now());
      progressTimer = setTimeout(() => {
        progressTimer = undefined;
        lastProgressAt = Date.now();
        progressHandler.current();
      }, wait);
    };
    live.current = { sendProgress, isSubscribed: () => subscribed };

    const clearOthers = () => {
      present = [];
      presentRefs = new Set();
      known.clear();
      remoteStore.clear();
      onlineStore.set([]);
    };

    /** 접속자 목록이 바뀌었을 때 */
    const onPresenceSync = () => {
      if (!channel) return;
      // 💡 같은 계정으로 탭을 두 개 열면 사용자 번호(key)가 같아 목록에는 한 사람으로 들어갑니다.
      //    한 탭을 닫아도 다른 탭이 남아 있으면 key가 그대로 있으므로, 캐릭터가 사라지지 않습니다.
      const state = channel.presenceState();
      const next = Object.keys(state);
      const wasAlone = present.every((key) => key === myId);
      // 이미 접속해 있는 사람이 탭을 하나 더 열었거나 새로고침한 경우: 사람(key)은 그대로지만 접속 표시(presence_ref)가 새로 생깁니다.
      // 그 새 탭은 아직 아무의 자리도 모르므로, 새 사람이 온 것과 똑같이 내 자리를 알려 줍니다
      const refs = new Set<string>();
      for (const key of next) {
        if (key === myId) continue;
        for (const meta of state[key]) refs.add(meta.presence_ref);
      }
      const newTab = [...refs].some((ref) => !presentRefs.has(ref));
      presentRefs = refs;
      // 💡 Supabase 문서: 목록을 맞추는 동안 실제로 드나들지 않았는데도 join/leave 알림이 올 수 있습니다.
      //    그래서 알림을 믿지 않고, 이전 목록과 지금 목록을 직접 비교합니다.
      const { joined, left } = diffKeys(present, next);
      present = next;
      if (joined.length > 0 || left.length > 0) onlineStore.set(next.filter((key) => key !== myId));
      for (const id of left) known.delete(id);
      if (left.length > 0) syncStore();
      const newcomers = joined.filter((key) => key !== myId);
      if (newcomers.length === 0 && !newTab) return;
      // 화면에 집이 없는 사람이 접속했으면(방금 입주) 마을 정보를 다시 읽어 집을 그립니다
      if (newcomers.some((key) => !residentSet.current.has(key))) noteUnknown();
      if (wasAlone) {
        // 내가 방금 들어왔거나 혼자 있다가 첫 사람이 온 경우: 바로 내 자리를 알립니다
        requestSend();
      } else if (replyTimer === undefined) {
        // 이미 여럿이 있던 마을에 새 사람이 온 경우: 모두가 한꺼번에 답하지 않게 저마다 조금씩 기다렸다 답합니다.
        // 기다리는 동안 또 누가 와도 답은 한 번이면 됩니다
        replyTimer = setTimeout(() => {
          replyTimer = undefined;
          requestSend();
        }, Math.random() * joinReplyWindowMs(next.length));
      }
    };

    /** 다른 주민의 방송을 받았을 때 */
    const onMove = (payload: unknown) => {
      const move = parseMove(payload, bounds.current);
      if (!move || move.id === myId) return;
      // 💡 보낸 사람 번호(id)는 서버가 보증하지 않습니다(같은 마을 주민이 남의 번호를 적어 보낼 수 있음).
      //    그래서 캐릭터를 그리는 겉모습에만 쓰고, 편지 같은 중요한 일에는 쓰지 않습니다.
      known.set(move.id, { x: move.x, z: move.z, tx: move.tx, tz: move.tz });
      if (!residentSet.current.has(move.id)) {
        // 화면이 아직 모르는 주민(방금 입주): 마을 정보를 다시 읽으면 집과 이름이 생기고, 그때 캐릭터도 그려집니다
        noteUnknown();
        return;
      }
      syncStore(move.id);
    };

    /** 연결을 닫고 다른 주민을 화면에서 지웁니다. (다시 이으려면 ensureConnected) */
    const disconnect = () => {
      generation += 1;
      connecting = false;
      subscribed = false;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      clearTimeout(sendTimer);
      sendTimer = undefined;
      clearTimeout(replyTimer);
      replyTimer = undefined;
      clearTimeout(progressTimer);
      progressTimer = undefined;
      const ch = channel;
      channel = null;
      // 💡 마지막 채널을 치우면 실시간 연결(WebSocket)도 함께 닫힙니다
      if (ch) void supabase.removeChannel(ch);
      clearOthers();
    };

    /** 다음 재시도를 예약합니다. 처음 세 번은 2·5·12초, 그 뒤로는 30초마다 */
    const scheduleRetry = (status: string, message: string) => {
      const delay = RETRY_DELAYS_MS[attempt] ?? SLOW_RETRY_MS;
      attempt += 1;
      if (attempt === RETRY_DELAYS_MS.length + 1) {
        console.warn("[함께 걷기] 실시간 채널에 들어가지 못했습니다:", status, message);
      }
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        // 화면을 안 보고 있거나 인터넷이 끊겼으면 시도하지 않습니다 (돌아올 때 ensureConnected가 다시 잇습니다)
        if (mayConnect()) void connect();
      }, delay);
    };

    const connect = async () => {
      if (disposed || channel || connecting) return;
      connecting = true;
      const mine = generation;
      const stale = () => disposed || generation !== mine;
      // 3D 모델을 받는 중에는 잇지 않습니다: 내 캐릭터가 화면에 선 뒤(자리가 적힌 뒤)에 시작합니다
      while (!walkStore.getPos()) {
        await sleep(READY_POLL_MS);
        if (stale()) return;
      }
      // 로그인 정보(토큰)를 실시간 연결에 실어 둡니다. 없으면 비공개 채널에서 거부됩니다
      await supabase.realtime.setAuth().catch(() => {});
      if (stale()) return;
      connecting = false;
      const ch = supabase.channel(topic, { config: { private: true, presence: { key: myId }, broadcast: { self: false } } });
      channel = ch;
      ch.on("presence", { event: "sync" }, onPresenceSync);
      ch.on("broadcast", { event: MOVE_EVENT }, (message) => onMove(message.payload));
      ch.on("broadcast", { event: PROGRESS_EVENT }, onProgress);
      ch.subscribe((status, error) => {
        // 이미 버린 채널이 뒤늦게 알려 온 것은 무시합니다
        if (disposed || channel !== ch) return;
        if (status === "SUBSCRIBED") {
          subscribed = true;
          attempt = 0;
          // 끊겼다가 다시 이어진 경우: 그 사이에 놓친 알림이 있을 수 있으므로 진행 숫자를 한 번 다시 읽습니다
          if (everSubscribed) onProgress();
          everSubscribed = true;
          // "나 접속했어요"를 한 번 알립니다. 접속 여부만 알리므로 내용은 비워 둡니다
          void ch.track({}).catch(() => {});
          return;
        }
        // 그 밖(CHANNEL_ERROR·TIMED_OUT·CLOSED): 연결이 끊긴 것이므로 다른 주민을 화면에서 지웁니다.
        // 💡 채널을 치우고 우리가 직접 다시 만듭니다. (치우지 않으면 도구가 알아서 다시 들어가려 해서 재시도가 두 겹이 됩니다)
        subscribed = false;
        channel = null;
        void supabase.removeChannel(ch);
        clearOthers();
        // 💡 실시간 서버가 쉬다가 깨어나는 순간에는 첫 참가가 한 번 거부될 수 있어, 조금 뒤 다시 시도합니다 (Task 025-4)
        scheduleRetry(status, error?.message ?? "");
      });
    };

    /** 연결이 없으면 지금 바로 새로 잇습니다 (돌아왔을 때·인터넷이 돌아왔을 때). 재시도 횟수도 처음부터 셉니다 */
    const ensureConnected = () => {
      if (disposed || channel || connecting || !mayConnect()) return;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      attempt = 0;
      void connect();
    };

    // 화면을 안 보게 되면(다른 탭·다른 앱) 10초 뒤 연결을 닫고, 다시 보면 새로 잇습니다
    const onVisibility = () => {
      clearTimeout(hideTimer);
      hideTimer = undefined;
      if (document.visibilityState === "hidden") hideTimer = setTimeout(disconnect, HIDDEN_DISCONNECT_MS);
      else ensureConnected();
    };
    // 페이지를 떠날 때(닫기·다른 주소로 이동): 바로 닫아서 다른 사람 화면에서 곧 사라지게 합니다
    const onPageHide = () => {
      clearTimeout(hideTimer);
      hideTimer = undefined;
      disconnect();
    };
    // 인터넷이 끊기면 다른 주민을 지우고(멈춰 선 유령이 남지 않게), 돌아오면 새로 잇습니다
    const onOffline = () => disconnect();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    // pageshow: "뒤로 가기"로 이 화면이 되살아났을 때도 다시 잇습니다
    window.addEventListener("pageshow", ensureConnected);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", ensureConnected);

    if (mayConnect()) void connect();

    // 땅을 눌러 목표가 바뀌면 방송을 예약합니다
    const unsubscribeWalk = walkStore.subscribe(requestSend);
    // 접속자가 상한을 넘을 때만: 내가 걸어 다니면 가까운 사람이 달라지므로 1초마다 다시 고릅니다
    const repickTimer = setInterval(() => {
      if (known.size > MAX_REMOTE_AVATARS) syncStore();
    }, REPICK_MS);

    return () => {
      disposed = true;
      reconcile.current = null;
      live.current = null;
      unsubscribeWalk();
      clearInterval(repickTimer);
      clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", ensureConnected);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", ensureConnected);
      disconnect();
    };
  }, [enabled, villageId, myId, walkStore, remoteStore, onlineStore]);

  // 돌려주는 함수는 늘 같은 것(useMemo)이라, 받는 쪽이 이 값 때문에 다시 그려지거나 타이머를 다시 걸지 않습니다
  return useMemo(
    () => ({
      announceProgress: () => live.current?.sendProgress(),
      isConnected: () => live.current?.isSubscribed() ?? false,
    }),
    [],
  );
}
