import Link from "next/link";
import { Stepper as MantineStepper } from "@mantine/core";
import { MYT } from "@/components/ui/myt";

const defaultSteps = ["כרטיסים", "טיסה", "מלון", "סיום"];

type StepperProps = {
  currentStep: number;
  onStepperClick: (step: number) => void;
  steps?: string[];
  /** Step 4 (checkout) hides the steps but keeps the logo as a way home. */
  hideSteps?: boolean;
};

/**
 * Booking progress indicator. Mantine renders the three states distinctly
 * once primaryColor (mint) is set: completed = filled + check, active =
 * outlined, upcoming = muted. Forward steps are not selectable.
 * The MYT wordmark sits at the inline-start (right in RTL) and links home —
 * the global header is hidden inside the order flow.
 */
export const Stepper = ({
  currentStep,
  onStepperClick,
  steps = defaultSteps,
  hideSteps = false,
}: StepperProps) => {
  const active = currentStep - 1;
  return (
    <div className="mx-auto my-4 flex w-full max-w-5xl flex-col items-center gap-3 px-4 sm:my-6 sm:flex-row sm:gap-8 sm:px-10">
      <Link href="/" aria-label="חזרה לדף הבית" className="shrink-0">
        <MYT className="h-5 w-auto text-foreground md:h-6" />
      </Link>
      {!hideSteps && (
        <div className="w-full max-w-2xl flex-1">
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
      )}
    </div>
  );
};
