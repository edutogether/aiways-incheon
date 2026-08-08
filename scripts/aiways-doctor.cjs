"use strict";
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),runtime=require("./lib/aiways-execution-runtime.cjs");
const root=path.resolve(__dirname,".."),functionsRoot=path.join(root,"functions"),imageRoot="D:\\Project\\_review-packages\\aiways-recognition-real-images-20260808",firebase="C:\\Users\\817be\\AppData\\Roaming\\npm\\firebase.cmd";
const imageCount=name=>{const dir=path.join(imageRoot,name);return fs.existsSync(dir)?fs.readdirSync(dir).filter(file=>/\.(jpg|jpeg|png|webp)$/i.test(file)).length:0;};
const checks=[
 ["product root",fs.existsSync(root)], ["functions",fs.existsSync(functionsRoot)], ["functions node_modules",fs.existsSync(path.join(functionsRoot,"node_modules"))],
 ["@google/genai resolution",(()=>{try{return Boolean(Module.createRequire(path.join(functionsRoot,"package.json")).resolve("@google/genai"));}catch{return false;}})()],
 ["firebase cli",fs.existsSync(firebase)], ["benchmark images",[imageCount("01_EASY"),imageCount("02_MEDIUM"),imageCount("03_HARD"),imageCount("04_EXTREME")].every(count=>count===10)]
];
for(const [name,ok] of checks)console.log(`${name}: ${ok?"PASS":"FAIL"}`);console.log(`Gemini credential source: ${runtime.getGeminiCredentialSource()}`);console.log(`FINAL: ${checks.every(([,ok])=>ok)?"PASS":"FAIL"}`);process.exitCode=checks.every(([,ok])=>ok)?0:1;
