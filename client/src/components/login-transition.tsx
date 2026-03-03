import { motion } from "framer-motion";
import { Logo } from "./ui/logo";

export function LoginTransition() {
  const logoVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: { opacity: 1, scale: 1.5, transition: { duration: 0.5, ease: "easeInOut" } },
    exit: { opacity: 0, scale: 2, transition: { duration: 0.5, ease: "easeOut" } },
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background z-50">
      <motion.div
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={logoVariants}
      >
        <Logo className="text-primary" />
      </motion.div>
    </div>
  );
}
