"use client";

// 개발용: 화면을 1초에 몇 장 그리는지(FPS) 보여 주는 작은 표시입니다. 주소에 ?fps=1 이 있을 때만 보입니다. (Task 025-2)
// 다른 주민 캐릭터가 늘어날 때 실제 휴대폰에서 얼마나 느려지는지 눈으로 확인하는 데 씁니다.
//
// 보여 주는 값:
//  - 지금: 최근 1초 동안의 평균 장 수
//  - 최저: 최근 10초 가운데 가장 느렸던 1초의 장 수
//  - 가장 긴 장면: 최근 1초 가운데 가장 오래 걸린 한 장의 시간(밀리초). 순간 끊김을 봅니다

import { useEffect, useState } from "react";
import { UI_COLORS } from "@/lib/village/theme";

export function FpsMeter({ note }: { note?: string }) {
  const [stat, setStat] = useState({ fps: 0, low: 0, worst: 0 });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let windowStart = last;
    let frames = 0;
    let worst = 0;
    const history: number[] = [];
    // 💡 requestAnimationFrame: 브라우저가 화면을 한 장 그릴 때마다 불러 주는 함수. 1초에 몇 번 불렸는지 세면 FPS입니다
    const tick = (now: number) => {
      frames += 1;
      worst = Math.max(worst, now - last);
      last = now;
      if (now - windowStart >= 1000) {
        const fps = Math.round((frames * 1000) / (now - windowStart));
        history.push(fps);
        if (history.length > 10) history.shift();
        setStat({ fps, low: Math.min(...history), worst: Math.round(worst) });
        frames = 0;
        worst = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <p
      data-testid="fps-meter"
      className="self-start rounded-full px-3 py-1 text-xs font-semibold tabular-nums text-white shadow-md"
      style={{ backgroundColor: `${UI_COLORS.navy}e6` }}
    >
      FPS {stat.fps} · min {stat.low} · {stat.worst}ms{note ? ` · ${note}` : ""}
    </p>
  );
}
