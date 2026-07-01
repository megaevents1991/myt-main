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
    // Static (non-sticky) header — it scrolls away with the page. The global
    // header is hidden inside the order flow, so this just marks the top.
    <div className="border-b border-border bg-background">
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:gap-8 sm:px-10 sm:py-4">
      <Link href="/" aria-label="חזרה לדף הבית" className="shrink-0">
        <MYT className="h-5 w-auto text-foreground md:h-6" />
      </Link>
      {!hideSteps && (
        <div className="w-full max-w-2xl flex-1">
          <MantineStepper
            onStepClick={onStepperClick}
            size="md"
            active={active}
            allowNextStepsSelect={false}
            // Brand light-green (mint, shade 4 #5BFF95) for the progress —
            // overrides the global primaryShade 6 just for the stepper.
            color="myColor.4"
            styles={{
              stepLabel: { fontWeight: 700, fontSize: 15 },
              // Dark-green check on the mint fill so it stays legible.
              stepCompletedIcon: { color: "#0A1A14" },
              // All 4 steps stay on one line on phones; the media query in
              // globals.css shrinks icons/labels/separators to make them fit.
              steps: { flexWrap: "nowrap" },
              // Loosen the connecting lines between steps a touch.
              separator: { marginInline: 16 },
            }}
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
    </div>
  );
};
