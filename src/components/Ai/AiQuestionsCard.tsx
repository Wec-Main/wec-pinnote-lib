import { useEffect, useId, useRef, useState } from "react";
import type { AiQuestion } from "../../types/ai.types";
import { Icon } from "../primitives";
import { formatAnswers, isAnswered, EMPTY_ANSWER, type AiQuestionAnswer } from "./aiQuestions";

export interface AiQuestionsCardProps {
  questions: readonly AiQuestion[];
  onSubmit?: (answers: string) => void;
  disabled?: boolean;
  className?: string;
}

const AUTO_ADVANCE_MS = 180;

export function AiQuestionsCard({
  questions,
  onSubmit,
  disabled,
  className,
}: AiQuestionsCardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AiQuestionAnswer[]>(() =>
    questions.map(() => ({ ...EMPTY_ANSWER })),
  );
  const [sent, setSent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingId = useId();
  const interactive = Boolean(onSubmit) && !disabled && !sent;
  const total = questions.length;
  const last = step === total - 1;
  const question = questions[step];
  const answer = answers[step] ?? EMPTY_ANSWER;
  const answeredCount = answers.filter(isAnswered).length;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!question) return null;

  const patch = (next: Partial<AiQuestionAnswer>) =>
    setAnswers((current) =>
      current.map((item, index) => (index === step ? { ...item, ...next, skipped: false } : item)),
    );

  const go = (to: number) => setStep(Math.max(0, Math.min(total - 1, to)));

  const finish = (list: AiQuestionAnswer[]) => {
    if (!onSubmit || sent) return;
    setSent(true);
    onSubmit(formatAnswers(questions, list));
  };

  const advance = (list: AiQuestionAnswer[]) => {
    if (last) finish(list);
    else go(step + 1);
  };

  const pick = (label: string) => {
    if (!interactive) return;
    if (question.multiSelect) {
      const has = answer.selected.includes(label);
      patch({
        selected: has
          ? answer.selected.filter((item) => item !== label)
          : [...answer.selected, label],
      });
      return;
    }
    const next = { ...answer, selected: [label], skipped: false };
    setAnswers((current) => current.map((item, index) => (index === step ? next : item)));
    if (!last && !answer.custom.trim()) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => go(step + 1), AUTO_ADVANCE_MS);
    }
  };

  const onCustom = (value: string) => {
    patch({ custom: value });
  };

  const skip = () => {
    const next = answers.map((item, index) =>
      index === step ? { selected: [], custom: "", skipped: true } : item,
    );
    setAnswers(next);
    advance(next);
  };

  const next = () => advance(answers);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.stopPropagation();
    const target = event.target as HTMLElement;
    const typing = target.tagName === "INPUT";
    if (typing && event.key === "Enter") {
      event.preventDefault();
      if (isAnswered(answer)) next();
      return;
    }
    if (typing) return;
    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < question.options.length) {
      event.preventDefault();
      pick(question.options[index]?.label ?? "");
    }
  };

  const canContinue = isAnswered(answer);
  const finalReady = last && answeredCount > 0;

  if (!interactive && !sent && !onSubmit) {
    return (
      <div className={["wpn-ai-q", "wpn-ai-q--done", className].filter(Boolean).join(" ")}>
        <p className="wpn-ai-q__done-title">
          <Icon name="check" /> Questions answered
        </p>
        <ul className="wpn-ai-q__done-list">
          {questions.map((item) => (
            <li key={item.question}>{item.question}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (sent) {
    return (
      <div className={["wpn-ai-q", "wpn-ai-q--done", className].filter(Boolean).join(" ")}>
        <p className="wpn-ai-q__done-title">
          <Icon name="check" /> Answers sent
        </p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={["wpn-ai-q", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
    >
      <div className="wpn-ai-q__head">
        <span className="wpn-ai-q__spark" aria-hidden="true">
          <Icon name="sparkles" />
        </span>
        <span id={headingId} className="wpn-ai-q__title">
          A few quick questions
        </span>
        {total > 1 ? (
          <span className="wpn-ai-q__progress" aria-label={`Question ${step + 1} of ${total}`}>
            {questions.map((item, index) => (
              <button
                key={item.question}
                type="button"
                className={[
                  "wpn-ai-q__dot",
                  index === step ? "wpn-ai-q__dot--current" : "",
                  isAnswered(answers[index]) ? "wpn-ai-q__dot--done" : "",
                ].join(" ")}
                aria-label={`Go to question ${index + 1}`}
                aria-current={index === step ? "step" : undefined}
                disabled={disabled}
                onClick={() => go(index)}
              />
            ))}
          </span>
        ) : null}
      </div>
      <div className="wpn-ai-q__body" key={step}>
        {question.header ? <span className="wpn-ai-q__chip">{question.header}</span> : null}
        <p className="wpn-ai-q__question">{question.question}</p>
        {question.options.length > 0 ? (
          <div
            className="wpn-ai-q__options"
            role={question.multiSelect ? "group" : "radiogroup"}
            aria-label={question.question}
          >
            {question.options.map((option, index) => {
              const selected = answer.selected.includes(option.label);
              return (
                <button
                  key={option.label}
                  type="button"
                  role={question.multiSelect ? "checkbox" : "radio"}
                  aria-checked={selected}
                  className={["wpn-ai-q__option", selected ? "wpn-ai-q__option--on" : ""].join(" ")}
                  onClick={() => pick(option.label)}
                >
                  <span className="wpn-ai-q__key" aria-hidden="true">
                    {selected ? <Icon name="check" /> : index + 1}
                  </span>
                  <span className="wpn-ai-q__text">
                    <span className="wpn-ai-q__label">{option.label}</span>
                    {option.description ? (
                      <span className="wpn-ai-q__desc">{option.description}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        <label
          className={["wpn-ai-q__custom", answer.custom.trim() ? "wpn-ai-q__custom--on" : ""].join(
            " ",
          )}
        >
          <span className="wpn-ai-q__key" aria-hidden="true">
            <Icon name="edit" />
          </span>
          <input
            ref={customRef}
            type="text"
            className="wpn-ai-q__input"
            placeholder={
              question.options.length > 0 ? "Or type your own answer…" : "Type your answer…"
            }
            aria-label="Type your own answer"
            value={answer.custom}
            maxLength={500}
            onChange={(event) => onCustom(event.target.value)}
          />
        </label>
      </div>
      <div className="wpn-ai-q__foot">
        <button type="button" className="wpn-ai-link" disabled={!interactive} onClick={skip}>
          Skip
        </button>
        <span className="wpn-ai-q__spacer" />
        {step > 0 ? (
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={() => go(step - 1)}>
            <Icon name="chevronLeft" className="wpn-btn__icon" />
            Back
          </button>
        ) : null}
        <button
          type="button"
          className="wpn-btn wpn-btn--primary"
          disabled={!interactive || (last ? !finalReady && !canContinue : !canContinue)}
          onClick={next}
        >
          {last ? "Send answers" : "Next"}
          {last ? null : <Icon name="chevronRight" className="wpn-btn__icon" />}
        </button>
      </div>
    </div>
  );
}
