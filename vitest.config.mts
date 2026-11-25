// 자동 테스트 도구(Vitest) 설정입니다.
// 코드에서 쓰는 "@/…" 경로(예: @/types/domain)를 테스트에서도 알아듣게 해 줍니다.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // "@" = 이 설정 파일이 있는 폴더(프로젝트 맨 위)
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // 테스트 파일 위치: 이름이 .test.ts 로 끝나는 파일 (예전 시안 보관함과 설치 폴더는 제외)
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "_archive/**", ".next/**"],
  },
});
