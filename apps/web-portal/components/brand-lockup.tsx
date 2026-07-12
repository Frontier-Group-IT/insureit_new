import Image from "next/image";

const markUrl = "https://raw.githubusercontent.com/antnish1/insureit_new/main/apps/mobile-app/assets/brand/insureit-primary-logo-clean.png";

type Props = {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
};

export function BrandLockup({ compact = false, inverse = false, className = "" }: Props) {
  const nameColor = inverse ? "text-white" : "text-[#071D49]";
  const taglineColor = inverse ? "text-white/78" : "text-[#071D49]";

  return (
    <div className={`flex min-w-0 items-center ${compact ? "gap-2" : "gap-2.5"} ${className}`}>
      <Image
        src={markUrl}
        alt="InsureIT"
        width={compact ? 34 : 42}
        height={compact ? 34 : 42}
        className={`${compact ? "h-8.5 w-8.5" : "h-10.5 w-10.5"} shrink-0 object-contain`}
        unoptimized
        priority
      />
      <div className="min-w-0 leading-none">
        <div className={`${compact ? "text-[19px]" : "text-[23px]"} truncate font-black tracking-[-0.03em] ${nameColor}`}>insureit</div>
        <div className={`${compact ? "mt-0.5 text-[6.5px]" : "mt-1 text-[7.5px]"} truncate font-black uppercase tracking-[0.02em] ${taglineColor}`}>YOUR SAFETY, OUR PROMISE</div>
      </div>
    </div>
  );
}
