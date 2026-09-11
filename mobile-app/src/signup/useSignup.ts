// 정식 가입 흐름.
//
// 한 화면에서 학생과 담임을 모두 처리한다(2026-09-02 결정: "가입 경로를 두
// 개나 만들지 말라"). 담임을 고르면 번호 칸이 인증코드 칸으로 바뀔 뿐,
// 별도 화면이나 별도 코드 입력창은 없다.
//
// 가입 뒤 카드는 세 가지 중 하나로 바뀐다 - 가입 완료(반 변경 가능),
// 승인 대기, 담임 인증 완료.
import { useCallback, useEffect, useRef, useState } from "react";
import { edu2gClient } from "../legacy/globals";
import { STORAGE_KEYS, readRaw, writeRaw } from "../state/storage";
import type { ConfirmRequest } from "../state/useConfirmModal";
import type { ToastTone } from "../state/useToasts";
import { useSchoolSearch } from "./useSchoolSearch";

export type SignupRole = "student" | "homeroom";

export interface StudentProfile {
  schoolId: string;
  schoolName?: string;
  grade: string;
  classNum: string;
  studentNumber: string;
  name: string;
}

export interface TeacherSummary {
  schoolId: string;
  schoolName: string;
  grade: string;
  classNum: string;
  name: string;
}

export type SignupState =
  | { kind: "form" }
  | { kind: "locked"; profile: StudentProfile }
  | { kind: "pending"; preview: Partial<StudentProfile> }
  | { kind: "teacherVerified"; summary: TeacherSummary };

interface SignupOptions {
  showToast: (message: string, tone?: ToastTone) => void;
  openConfirm: (request: ConfirmRequest) => void;
  onProfileChanged: () => void;
}

function clean(value: string | undefined): string {
  return (value ?? "").toString().trim();
}

/** 쿨다운이 걸렸을 때 "몇 시간 뒤"를 사람이 읽는 말로 바꾼다. */
export function formatCooldownWait(retryAfterSeconds: number | undefined): string {
  const hours = Math.ceil((retryAfterSeconds ?? 0) / 3600);
  return hours > 1 ? `${hours}시간 뒤에 다시 시도해 주세요.` : "잠시 뒤에 다시 시도해 주세요.";
}

export function useSignup({ showToast, openConfirm, onProfileChanged }: SignupOptions) {
  const school = useSchoolSearch();
  const [role, setRole] = useState<SignupRole>("student");
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [homeroomName, setHomeroomName] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<SignupState>({ kind: "form" });
  const [bannerVisible, setBannerVisible] = useState(false);
  const [registeredSchoolId, setRegisteredSchoolId] = useState("");

  // 반 변경(가입 완료 카드 안)
  const [classChangeOpen, setClassChangeOpen] = useState(false);
  const [classChangeGrade, setClassChangeGrade] = useState("");
  const [classChangeClassNum, setClassChangeClassNum] = useState("");
  const [classChangeStatus, setClassChangeStatus] = useState("");
  const [classChangeSubmitting, setClassChangeSubmitting] = useState(false);

  const showLocked = useCallback((profile: StudentProfile) => {
    setRegisteredSchoolId(profile.schoolId);
    setBannerVisible(false);
    setState({ kind: "locked", profile });
    onProfileChanged();
  }, [onProfileChanged]);

  const showBanner = useCallback(() => {
    // "나중에"를 누른 적이 있으면 다시 띄우지 않는다.
    if (readRaw(STORAGE_KEYS.signupBannerDismissed) === "1") return;
    setBannerVisible(true);
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerVisible(false);
    writeRaw(STORAGE_KEYS.signupBannerDismissed, "1");
  }, []);

  // 이미 가입한 기기인지 서버에 물어본다. 실패하면(App Check 미통과·오프라인
  // 등) 가입 안내 배너를 띄우는 쪽으로 간다 - 가입한 사람에게 배너가 한 번
  // 더 뜨는 것이, 가입 안 한 사람이 영영 안내를 못 보는 것보다 낫다.
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const client = edu2gClient();
    const request = client?.checkStudentProfile?.();
    if (!request) {
      showBanner();
      return;
    }
    void request.then((response) => {
      const data = response.data as { hasProfile?: boolean; profile?: StudentProfile; pending?: boolean; pendingProfile?: Partial<StudentProfile> } | undefined;
      if (response.ok && data?.hasProfile && data.profile) {
        showLocked(data.profile);
        return;
      }
      if (response.ok && data?.pending) {
        setBannerVisible(false);
        setState({ kind: "pending", preview: data.pendingProfile ?? {} });
        return;
      }
      showBanner();
    }).catch(() => showBanner());
  }, [showBanner, showLocked]);

  const submit = useCallback(async () => {
    const client = edu2gClient();
    if (!client?.previewStudentProfile || !client.registerStudentProfile) {
      setStatus("지금은 가입을 처리할 수 없어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const selection = school.selection;
    const trimmedGrade = clean(grade);
    const trimmedClassNum = clean(classNum);

    if (role === "homeroom") {
      const name = clean(homeroomName);
      const code = clean(teacherCode);
      if (!selection || !trimmedGrade || !trimmedClassNum || !name || !code) {
        setStatus("학교를 검색해서 목록에서 고르고, 학년/반/성함/인증코드를 모두 입력해 주세요.");
        return;
      }
      setSubmitting(true);
      setStatus("확인하는 중입니다...");
      const result = await client.registerStudentProfile({
        schoolId: selection.schoolId, schoolName: selection.schoolName,
        grade: trimmedGrade, classNum: trimmedClassNum, name, role, teacherCode: code
      });
      setSubmitting(false);
      const data = result.data as { verified?: boolean; code?: string } | undefined;
      if (result.ok && data?.verified) {
        setBannerVisible(false);
        setState({
          kind: "teacherVerified",
          summary: { schoolId: selection.schoolId, schoolName: selection.schoolName, grade: trimmedGrade, classNum: trimmedClassNum, name }
        });
        showToast(`🍎 ${trimmedGrade}학년 ${trimmedClassNum}반 담임 인증 완료 !`, "emerald");
        return;
      }
      setStatus(
        data?.code === "teacher_code_not_set" ? "이 반은 아직 인증코드가 준비되지 않았어요. 관리자에게 문의해 주세요."
          : data?.code === "invalid_code" ? "인증코드를 다시 확인해 주세요."
          : data?.code === "teacher_code_locked" ? "시도가 너무 많아 이 반은 잠시 잠겼어요. 15분 뒤 다시 시도해 주세요."
          : "인증에 실패했어요. 다시 시도해 주세요."
      );
      return;
    }

    const number = clean(studentNumber);
    const name = clean(studentName);
    if (!selection || !trimmedGrade || !trimmedClassNum || !number || !name) {
      setStatus("학교를 검색해서 목록에서 고르고, 학년/반/번호/이름을 모두 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setStatus("확인 중입니다...");
    const preview = await client.previewStudentProfile({
      schoolId: selection.schoolId, schoolName: selection.schoolName,
      grade: trimmedGrade, classNum: trimmedClassNum, studentNumber: number, name, role
    });
    setSubmitting(false);
    const previewData = preview.data as { code?: string; profile?: StudentProfile } | undefined;
    if (!preview.ok) {
      setStatus(previewData?.code === "already_registered" ? "이미 가입된 기기예요." : "입력 내용을 다시 확인해 주세요.");
      if (previewData?.profile) showLocked(previewData.profile);
      return;
    }

    // 기기에 영구히 고정되는 결정이라 한 번 더 묻는다.
    openConfirm({
      title: "가입 정보 확인",
      description: `정말 "${selection.schoolName} ${trimmedGrade}학년 ${trimmedClassNum}반 ${number}번 ${name}" 학생이 맞나요 ?
가입하면 이 기기에 영구히 저장되고 다시 바꿀 수 없어요.`,
      icon: "🎓",
      confirmClass: "bg-blue-600 hover:bg-blue-700",
      onConfirm: () => {
        setStatus("가입하는 중입니다...");
        void client.registerStudentProfile!({
          schoolId: selection.schoolId, schoolName: selection.schoolName,
          grade: trimmedGrade, classNum: trimmedClassNum, studentNumber: number, name, role
        }).then((result) => {
          const data = result.data as { pending?: boolean; preview?: Partial<StudentProfile>; code?: string; profile?: StudentProfile } | undefined;
          if (result.ok && data?.pending) {
            setBannerVisible(false);
            setState({ kind: "pending", preview: data.preview ?? {} });
            showToast(`⏳ "${name}" 학생 가입 신청 완료 ! 선생님 승인을 기다려 주세요.`, "amber");
            return;
          }
          setStatus(
            data?.code === "already_registered" ? "이미 가입된 기기예요."
              : data?.code === "student_number_taken" ? "그 번호는 우리 반에서 이미 쓰고 있어요. 번호를 다시 확인해 주세요."
              : "가입에 실패했어요. 다시 시도해 주세요."
          );
          if (data?.profile) showLocked(data.profile);
        });
      }
    });
  }, [school.selection, role, grade, classNum, homeroomName, teacherCode, studentNumber, studentName, openConfirm, showToast, showLocked]);

  const submitClassChange = useCallback(async () => {
    const client = edu2gClient();
    const nextGrade = clean(classChangeGrade);
    const nextClassNum = clean(classChangeClassNum);
    if (!nextGrade || !nextClassNum) {
      setClassChangeStatus("학년/반을 모두 입력해 주세요.");
      return;
    }
    if (!client?.previewClassChange || !client.changeStudentClass) {
      setClassChangeStatus("지금은 변경을 처리할 수 없어요.");
      return;
    }
    setClassChangeSubmitting(true);
    setClassChangeStatus("확인 중입니다...");
    const preview = await client.previewClassChange({ grade: nextGrade, classNum: nextClassNum });
    setClassChangeSubmitting(false);
    const previewData = preview.data as { code?: string; retryAfterSeconds?: number; preview?: StudentProfile } | undefined;
    if (!preview.ok) {
      setClassChangeStatus(
        previewData?.code === "cooldown_active" ? formatCooldownWait(previewData.retryAfterSeconds)
          : previewData?.code === "no_change" ? "이미 그 반으로 등록돼 있어요."
          : "입력 내용을 다시 확인해 주세요."
      );
      return;
    }
    const target = previewData?.preview;
    if (!target) {
      setClassChangeStatus("입력 내용을 다시 확인해 주세요.");
      return;
    }
    openConfirm({
      title: "반 변경 확인",
      description: `정말 "${target.schoolName || target.schoolId} ${target.grade}학년 ${target.classNum}반"으로 바꾸시겠어요 ? 반 변경은 하루에 한 번만 할 수 있어요.`,
      icon: "🔄",
      confirmClass: "bg-blue-600 hover:bg-blue-700",
      onConfirm: () => {
        setClassChangeStatus("변경하는 중입니다...");
        void client.changeStudentClass!({ grade: nextGrade, classNum: nextClassNum }).then((result) => {
          const data = result.data as { profile?: StudentProfile; code?: string; retryAfterSeconds?: number } | undefined;
          if (result.ok && data?.profile) {
            showLocked(data.profile);
            showToast(`🔄 ${target.grade}학년 ${target.classNum}반으로 변경 완료 !`, "emerald");
            return;
          }
          setClassChangeStatus(
            data?.code === "cooldown_active" ? formatCooldownWait(data.retryAfterSeconds)
              : data?.code === "student_number_taken" ? "그 번호는 이미 다른 학생이 쓰고 있어요. 선생님께 확인해 주세요."
              : "변경에 실패했어요. 다시 시도해 주세요."
          );
        });
      }
    });
  }, [classChangeGrade, classChangeClassNum, openConfirm, showToast, showLocked]);

  return {
    school, role, setRole,
    grade, setGrade, classNum, setClassNum,
    studentNumber, setStudentNumber, studentName, setStudentName,
    homeroomName, setHomeroomName, teacherCode, setTeacherCode,
    status, submitting, submit,
    state, bannerVisible, dismissBanner,
    registeredSchoolId,
    classChange: {
      open: classChangeOpen,
      toggle: () => setClassChangeOpen((current) => !current),
      grade: classChangeGrade, setGrade: setClassChangeGrade,
      classNum: classChangeClassNum, setClassNum: setClassChangeClassNum,
      status: classChangeStatus, submitting: classChangeSubmitting,
      submit: submitClassChange
    }
  };
}
