type StepperProps = {
  steps: { label: string }[];
  currentStep: number;
};

type StepProps = {
  label: string;
  state: "completed" | "active" | "inactive";
  isFirst: boolean;
  isLast: boolean;
  index: number;
};

const Step = ({ label, state, isFirst, isLast, index }: StepProps) => {
  return (
    <div
      className={`
        "flex-1 h-12 flex p-5 items-center justify-center text-xl font-medium" 
        ${state === "completed" && "bg-foreground text-secondary"} 
        ${
          state === "active" &&
          "bg-secondary text-primary-foreground shadow-2xl rounded-lg"
        } 
        ${state === "inactive" && "bg-foreground text-secondary"}
        ${isFirst && "rounded-r-lg"}
        ${isLast && "rounded-l-lg"}`}
    >
      <span className="sr-only">
        {state === "completed"
          ? "Completed"
          : state === "active"
          ? "Current"
          : "Upcoming"}
      </span>
      <span
        className="w-5 h-5 mr-2 inline-flex items-center justify-center rounded-full text-3xl font-bold"
        aria-hidden="true"
      >
        {index + 1}
      </span>

      {label}
    </div>
  );
};

export const PillStepper = ({ steps, currentStep }: StepperProps) => {
  return (
    <div
      className="flex w-full max-w-2xl mx-auto overflow-hidden rounded-full justify-center mt-4"
      dir="rtl"
    >
      {steps.map((step, index) => (
        <Step
          index={index}
          key={index}
          label={step.label}
          state={
            index < currentStep
              ? "completed"
              : index === currentStep
              ? "active"
              : "inactive"
          }
          isFirst={index === 0}
          isLast={index === steps.length - 1}
        />
      ))}
    </div>
  );
};
