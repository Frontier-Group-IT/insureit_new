import Image from "next/image";

const markUrl = "https://raw.githubusercontent.com/antnish1/insureit_new/main/apps/mobile-app/assets/brand/insureit-primary-logo-clean.png";

type Props = {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
  size?: "compact" | "default" | "hero";
};

export function BrandLockup({ compact = false, inverse = false, className = "", size }: Props) {
  const resolvedSize = size ?? (compact ? "compact" : "default");
  const nameColor = inverse ? "text-white" : "text-[#071D49]";
  const taglineColor = inverse ? "text-white/78" : "text-[#071D49]";
  const isHero = resolvedSize === "hero";
  const isCompact = resolvedSize === "compact";

  return (
    <div className={`flex min-w-0 items-center ${isHero ? "gap-4" : isCompact ? "gap-2" : "gap-2.5"} ${className}`}>
      <Image
        src={markUrl}
        alt="InsureIT"
        width={isHero ? 76 : isCompact ? 34 : 42}
        height={isHero ? 76 : isCompact ? 34 : 42}
        className={`${isHero ? "h-[76px] w-[76px]" : isCompact ? "h-8.5 w-8.5" : "h-10.5 w-10.5"} shrink-0 object-contain`}
        unoptimized
        priority
      />
      <div className={`${isHero ? "w-[250px]" : "min-w-0"} leading-none`}>
        <div className={`${isHero ? "text-[49px] leading-[0.88]" : isCompact ? "text-[19px]" : "text-[23px]"} truncate font-black tracking-[-0.055em] ${nameColor}`}>insureit</div>
        <div className={`${isHero ? "mt-2 text-[12px] tracking-[0.055em]" : isCompact ? "mt-0.5 text-[6.5px]" : "mt-1 text-[7.5px]"} truncate font-black uppercase ${taglineColor}`}>YOUR SAFETY, OUR PROMISE</div>
      </div>
    </div>
  );
}
