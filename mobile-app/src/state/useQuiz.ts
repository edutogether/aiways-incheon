// 3초 퀴즈.
//
// 문제는 매번 새로 뽑는다(pickQuizSet). 답을 고르면 해설이 뜨고 3초 카운트
// 다운 뒤 자동으로 다음 문제로 넘어간다 - 버튼 글자가 "3초 뒤 다음 문제 ➔"
// 처럼 1초마다 바뀌는 것까지 원본 그대로다.
import { useCallback, useEffect, useRef, useState } from "react";
import { pickQuizSet, quizRank, type QuizQuestion, type QuizRank } from "../data/sortingData";

const POINTS_PER_CORRECT = 10;
const AUTO_ADVANCE_SECONDS = 3;

export interface QuizAnswerFeedback {
  correct: boolean;
  explanation: string;
}

export interface QuizSummary {
  correctCount: number;
  score: number;
  total: number;
  rank: QuizRank;
}

export function useQuiz() {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => pickQuizSet());
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<QuizAnswerFeedback | null>(null);
  const [finished, setFinished] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  const clearAutoAdvance = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    setCountdown(null);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
  }, []);

  const goNext = useCallback(() => {
    clearAutoAdvance();
    setFeedback(null);
    setIndex((current) => {
      const next = current + 1;
      if (next >= questions.length) {
        setFinished(true);
        return current;
      }
      return next;
    });
  }, [clearAutoAdvance, questions.length]);

  // goNext가 바뀔 때마다 인터벌을 다시 걸지 않도록 최신 함수를 참조로 들고 간다.
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  const answer = useCallback((chosen: boolean) => {
    const question = questions[index];
    if (!question || feedback) return;
    const correct = chosen === question.answer;
    if (correct) setScore((current) => current + POINTS_PER_CORRECT);
    setFeedback({ correct, explanation: question.explanation });

    clearAutoAdvance();
    setCountdown(AUTO_ADVANCE_SECONDS);
    timer.current = window.setInterval(() => {
      setCountdown((remaining) => {
        const next = (remaining ?? 1) - 1;
        if (next <= 0) {
          goNextRef.current();
          return null;
        }
        return next;
      });
    }, 1000);
  }, [questions, index, feedback, clearAutoAdvance]);

  const restart = useCallback(() => {
    clearAutoAdvance();
    setQuestions(pickQuizSet());
    setIndex(0);
    setScore(0);
    setFeedback(null);
    setFinished(false);
  }, [clearAutoAdvance]);

  const correctCount = Math.round(score / POINTS_PER_CORRECT);
  const summary: QuizSummary = {
    correctCount,
    score,
    total: questions.length,
    rank: quizRank(correctCount)
  };

  return {
    question: questions[index],
    index,
    total: questions.length,
    score,
    feedback,
    finished,
    countdown,
    summary,
    answer,
    goNext,
    restart
  };
}
