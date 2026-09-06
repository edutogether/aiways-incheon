"use strict";
// D:\Projects\_shared\CONVENTIONS.md 5.2 - eslint 통일(없던 앱에 추가).
// poster-studio/functions/eslint.config.js와 같은 최소 설정 - 엄격한 스타일
// 강제보다는 실수(안 쓰는 변수, undefined 참조 등)를 잡는 데 초점.
// 기존 "check" 스크립트(node --check, 문법검사만)는 그대로 두고 이 lint는
// 별도로 추가된 것 - check를 대체하지 않는다.
module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        structuredClone: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-undef": "error"
    }
  }
];
