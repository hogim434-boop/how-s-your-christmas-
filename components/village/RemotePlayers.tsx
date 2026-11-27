"use client";

// 같은 마을에 지금 접속해 있는 "다른 주민들"의 캐릭터입니다. (Task 025-2, 026)
//
// 그리는 방식이 두 가지 있고, 여기서 고릅니다.
//  - RemoteCrowd.tsx (기본): 자세를 미리 구워 두고 모두를 한 번에 그립니다. 사람이 많아져도 거의 느려지지 않습니다. (Task 026)
//  - RemotePlayersClassic.tsx (예비): 주민마다 모델을 복사해 따로 그립니다. 사람 수만큼 느려집니다.
//    → 모델이 예상과 달라 새 방식의 재료를 만들지 못했을 때, 또는 연습용 마을에서 &classic=1 로 비교할 때만 씁니다.

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { CHARACTER_MODEL_URL } from "./characterModel";
import { buildCrowdAssets } from "./crowdModel";
import { CROWD_CAPACITY, RemoteCrowd } from "./RemoteCrowd";
import { RemotePlayersClassic, type RemotePlayersProps } from "./RemotePlayersClassic";

interface Props extends RemotePlayersProps {
  /** 개발용: true면 예전 방식(주민마다 따로 그리기)으로 그립니다 */
  classic?: boolean;
}

export function RemotePlayers({ classic = false, ...props }: Props) {
  const { scene, animations } = useGLTF(CHARACTER_MODEL_URL);
  // 모두를 한 번에 그리기 위한 재료. 만들 수 없는 모델이면 null → 예전 방식으로 그립니다
  const assets = useMemo(
    () => (classic ? null : buildCrowdAssets(scene, animations, CROWD_CAPACITY)),
    [classic, scene, animations],
  );
  useEffect(() => () => assets?.dispose(), [assets]);
  return assets ? <RemoteCrowd {...props} assets={assets} /> : <RemotePlayersClassic {...props} />;
}
