// mobile-app 전용 린트 설정. 저장소 루트와 functions/의 설정은 이 폴더를
// 보지 않으므로(각자 자기 범위만 본다) 여기 따로 둔다.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules"] },
  js.configs.recommended,
  {
    // 타입 정보를 쓰는 규칙은 .ts/.tsx 에만 건다. 이 설정 파일(.js)까지
    // 걸면 "타입 프로젝트에 없는 파일"이라며 린트 자체가 죽는다.
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules }
  },
  {
    // 빌드 설정은 Node에서 돈다.
    files: ["vite.config.ts"],
    languageOptions: { globals: globals.node }
  },
  {
    files: ["eslint.config.js"],
    languageOptions: { globals: globals.node }
  }
);
