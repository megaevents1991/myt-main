import { Stepper as MantineStepper } from "@mantine/core";

const defaultSteps = ["כרטיסים", "טיסה", "מלון", "סיום"];

type StepperProps = {
  currentStep: number;
  onStepperClick: (step: number) => void;
  steps?: string[];
};

/**
 * Booking progress indicator. Mantine renders the three states distinctly
 * once primaryColor (mint) is set: completed = filled + check, active =
 * outlined, upcoming = muted. Forward steps are not selectable.
 */
export const Stepper = ({
  currentStep,
  onStepperClick,
  steps = defaultSteps,
}: StepperProps) => {
  const active = currentStep - 1;
  return (
    <div className="mx-auto my-6 w-full max-w-2xl px-4 sm:px-10">
      <MantineStepper
        onStepClick={onStepperClick}
        size="sm"
        active={active}
        allowNextStepsSelect={false}
        styles={{ stepLabel: { fontWeight: 700 } }}
      >
        {steps.map((step, index) => (
          <MantineStepper.Step
            key={index}
            label={step}
            allowStepSelect={index <= active}
          />
        ))}
      </MantineStepper>
    </div>
  );
};
