import { Stepper as MantineStepper } from "@mantine/core";

type StepperProps = {
  currentStep: number;
  onStepperClick: (step: number) => void;
};

const StepperLabel = ({ label }: { label: string }) => {
  return (
    <div className="text-secondary w-full flex font-bold justify-center text-lg">
      {label}
    </div>
  );
};

export const Stepper = ({ currentStep, onStepperClick }: StepperProps) => {
  return (
    <div className="w-full max-w-2xl mx-auto my-6 px-10" dir="rtl">
      <MantineStepper
        onStepClick={onStepperClick}
        size="sm"
        active={currentStep - 1}
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
        <MantineStepper.Step label={<StepperLabel label="כרטיסים" />} />
        <MantineStepper.Step label={<StepperLabel label="טיסות" />} />
        <MantineStepper.Step label={<StepperLabel label="מלונות" />} />
      </MantineStepper>
    </div>
  );
};
