"use client";

// 같은 마을에 지금 접속해 있는 "다른 주민들"의 캐릭터입니다. (Task 025-2, 026 → Task 014)
//
// 지금은 꾸미기 캐릭터(RemoteChibis.tsx)로 그립니다. 주민마다 옷이 달라 주민 한 명을 물체 하나로 그립니다.
// 💡 예전 캐릭터(KayKit Rogue)용 그리기 코드는 남아 있지만 더는 쓰지 않습니다:
//    RemoteCrowd.tsx·crowdModel.ts(자세를 미리 구워 모두를 한 번에 그리기), RemotePlayersClassic.tsx(한 명씩 따로), characterModel.ts

export { RemoteChibis as RemotePlayers } from "./RemoteChibis";
