import Image from "next/image";
import type { LucideIcon } from "lucide-react";

type IconVisualProps = {
  type: "icon";
  icon: LucideIcon;
  label: string;
  className?: string;
  iconClassName?: string;
  size?: number;
};

type ImageVisualProps = {
  type: "image";
  src: string;
  label: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  position?: string;
  priority?: boolean;
};

type VisualAssetProps = IconVisualProps | ImageVisualProps;

export function VisualAsset(props: VisualAssetProps) {
  if (props.type === "icon") {
    const Icon = props.icon;

    return (
      <span
        role="img"
        aria-label={props.label}
        className={`inline-flex items-center justify-center ${props.className ?? ""}`}
      >
        <Icon
          aria-hidden="true"
          size={props.size ?? 20}
          strokeWidth={1.8}
          className={props.iconClassName}
        />
      </span>
    );
  }

  return (
    <span className={`relative block overflow-hidden ${props.className ?? ""}`}>
      <Image
        src={props.src}
        alt={props.label}
        fill
        sizes={props.sizes ?? "160px"}
        priority={props.priority}
        className={`object-contain ${props.imageClassName ?? ""}`}
        style={{ objectPosition: props.position ?? "center" }}
      />
    </span>
  );
}
