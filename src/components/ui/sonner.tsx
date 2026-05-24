import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="dark"
    className="toaster group"
    position="top-center"
    duration={4200}
    closeButton
    toastOptions={{
      classNames: {
        toast:
          "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl",
        title: "group-[.toast]:font-bold",
        description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
      },
    }}
    {...props}
  />
);

export { Toaster, toast };
