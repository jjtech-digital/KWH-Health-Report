import Image from "next/image"

export function KWLogo() {
  return (
    <Image
      src="/images/kw-logo.png"
      alt="Kitchen Warehouse"
      width={160}
      height={44}
      className="h-8 sm:h-11 w-auto object-contain"
      priority
    />
  )
}
