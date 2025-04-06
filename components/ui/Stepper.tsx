import { cn } from "@/lib/utils";
import { Stepper as MantineStepper } from "@mantine/core";

const steps = ["כרטיסים", "טיסה", "מלון", "סיום"];

type StepperProps = {
  currentStep: number;
  onStepperClick: (step: number) => void;
};

const StepperLabel = ({
  label,
  completed,
}: {
  label: string;
  completed: boolean;
}) => {
  return (
    <div
      className={cn(
        "w-full flex font-bold justify-center text-lg",
        completed ? "text-secondary" : "text-main"
      )}
    >
      {label}
    </div>
  );
};

export const Stepper = ({ currentStep, onStepperClick }: StepperProps) => {
  const active = currentStep - 1;
  return (
    <div className="w-full max-w-2xl mx-auto my-6 px-10" dir="rtl">
      <MantineStepper
        onStepClick={onStepperClick}
        size="sm"
        active={active}
        styles={{
          step: {
            position: "relative",
          },
          stepBody: {
            display: "block",
            position: "absolute",
            bottom: "-80%",
            margin: "unset",
            width: "100%",
          },
        }}
      >
        {steps.map((step, index) => (
          <MantineStepper.Step
            key={index}
            label={<StepperLabel completed={index <= active} label={step} />}
          />
        ))}
      </MantineStepper>
    </div>
  );
};
