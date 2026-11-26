"use client";

// "이용 방법" 안내 창입니다. (11.27 사용자 요청: 처음 온 사람에게 어떤 서비스인지 알려 주기)
// 로그인하고 마을에 처음 들어왔을 때 한 번 자동으로 뜨고, 그 뒤로는 메뉴의 "이용 방법"으로 다시 볼 수 있습니다.
// 세 단계(친구 초대 → 편지 쓰기 → 트리 꾸미기)를 한 장씩 넘겨 보며, 단계마다 실제 마을 화면 그림을 함께 보여 줍니다.
// 창 틀은 다른 창과 같은 아래에서 올라오는 창(Overlay)을 그대로 씁니다.
//
// 🖼️ 그림은 public/howto/ 안에 있습니다 (연습용 마을 /village/demo 를 찍은 것, 960×640).
//    이름표·"편지 쓰기" 말풍선에 글자가 들어 있어서 언어별로 한 장씩 있습니다: invite-ko.jpg, invite-ja.jpg ...
//    ⚠️ 그림을 다시 찍어 넣을 때는 파일 이름도 바꿔 주세요 (예: invite2-ko.jpg).
//       같은 이름이면 브라우저와 Next.js가 기억해 둔 예전 그림을 한동안 계속 보여 줍니다.

import { useContext, useState } from "react";
import Image from "next/image";
import Overlay from "@/components/overlay/Overlay";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { LocaleContext, useMessages } from "@/i18n/LocaleContext";
import { UI_COLORS } from "@/lib/village/theme";

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

/** 단계별 그림 파일 이름의 앞부분 (뒤에 -ko.jpg / -ja.jpg 가 붙습니다) */
const STEP_IMAGES = ["invite", "letter", "decor"] as const;

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  const t = useMessages();
  return (
    <Overlay open={open} onClose={onClose} title={t.howToTitle}>
      {/* 창이 닫히면 이 부품이 통째로 사라지므로, 다시 열 때는 항상 1단계부터 시작합니다 */}
      <HowToSteps onClose={onClose} />
    </Overlay>
  );
}

function HowToSteps({ onClose }: { onClose: () => void }) {
  const t = useMessages();
  const locale = useContext(LocaleContext);
  // 지금 보고 있는 단계 (0부터 시작)
  const [step, setStep] = useState(0);

  const steps = [
    { title: t.howToStep1Title, desc: t.howToStep1Desc },
    { title: t.howToStep2Title, desc: t.howToStep2Desc },
    { title: t.howToStep3Title, desc: t.howToStep3Desc },
  ];
  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <div className="flex flex-col pt-1">
      {/* 그림 자리. 세 장을 겹쳐 두고 지금 단계의 그림만 보이게 합니다 (미리 불러 두어 넘길 때 바로 보입니다) */}
      <div
        className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl"
        style={{ backgroundColor: UI_COLORS.surface }}
      >
        {STEP_IMAGES.map((name, i) => (
          <Image
            key={name}
            src={`/howto/${name}-${locale}.jpg`}
            alt={i === step ? steps[i].title : ""}
            aria-hidden={i !== step}
            width={960}
            height={640}
            sizes="(min-width: 448px) 408px, 100vw"
            loading="eager"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${
              i === step ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>

      {/* 설명. aria-live: 단계가 바뀌면 화면 읽기 도구가 새 내용을 읽어 줍니다.
          min-h: 설명 길이가 달라도 아래 버튼이 위아래로 움직이지 않게 자리를 잡아 둡니다 */}
      <div aria-live="polite" className="min-h-[7.5rem] px-1 pt-4">
        <p className="text-xs font-bold" style={{ color: UI_COLORS.accent }}>
          <span aria-hidden="true">STEP {step + 1}</span>
          <span className="sr-only">{t.howToStepOf.replace("{n}", String(step + 1))}</span>
        </p>
        <p className="mt-1 text-[17px] font-bold tracking-tight">{current.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: UI_COLORS.muted }}>
          {current.desc}
        </p>
      </div>

      {/* 지금 몇 번째인지 보여 주는 점 */}
      <div aria-hidden="true" className="flex justify-center gap-1.5 pb-4">
        {steps.map((s, i) => (
          <span
            key={s.title}
            className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${i === step ? "w-5" : "w-1.5"}`}
            style={{ backgroundColor: i === step ? UI_COLORS.navy : "#d5d8e3" }}
          />
        ))}
      </div>

      <div className="flex gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className={`${SECONDARY_BUTTON} !w-auto shrink-0 px-6`}>
            {t.howToBack}
          </button>
        )}
        <button type="button" onClick={isLast ? onClose : () => setStep(step + 1)} className={PRIMARY_BUTTON}>
          {isLast ? t.howToStart : t.howToNext}
        </button>
      </div>
    </div>
  );
}
