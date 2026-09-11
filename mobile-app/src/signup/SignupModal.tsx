// 가입 모달 (2026-09-11, 지시 Bumm - "PC 거 그냥 사이즈만 줄여서 고대로").
//
// 🔴 **PC의 학교 선택 모달이 기준이다.** 임의로 개선하지 않는다:
//   - 가운데 동그란 아이콘 → 굵은 제목 → 입력칸 → 알약 버튼
//   - 학년·반은 PC와 **같은 드롭다운**(루트의 classPicker.js/.css 한 벌)
//   - 뒤 배경은 흐려지고, ✕ 또는 바깥을 눌러 닫는다
//
// 🔴 입력칸의 id와 필드 구성은 **하나도 바꾸지 않았다.** `useSignup`이 그 값을
// 읽고 서버로 보내는데, 여기서 이름을 바꾸면 가입이 조용히 깨진다.
import { useEffect, useRef } from "react";

export function SignupModal({ open, onClose, children, title, icon }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  icon: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // 🔴 showModal()이라야 네이티브 top-layer에 뜨고, Esc와 포커스 가두기가
    // 저절로 따라온다. `open` 속성만 켜면 그 셋을 전부 직접 만들어야 한다.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      id="signupModal"
      ref={ref}
      className="signup-modal"
      onClose={onClose}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
    >
      <div className="signup-modal-body">
        <button type="button" className="signup-modal-close" aria-label="닫기" onClick={onClose}>×</button>
        <div className="signup-modal-icon" aria-hidden="true">{icon}</div>
        <h2 className="signup-modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
