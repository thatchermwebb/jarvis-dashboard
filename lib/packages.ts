// Standard advertised packages, with chip colors for the client-profile picker.
// Values are the canonical strings stored on clients.advertised_package (and read
// by Media Buying when labelling Wilson's produce-ad tasks).

export interface PackageOption {
  value: string
  label: string
  chip: string // full chip classes (bg + text + border)
  dot: string
}

export const PACKAGE_OPTIONS: PackageOption[] = [
  { value: '$199 Full Detail - Steam',      label: '$199 Full Detail · Steam',      chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  { value: '$199 Full Detail - Extraction', label: '$199 Full Detail · Extraction', chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30',       dot: 'bg-blue-400'    },
  { value: '$149 Interior',                 label: '$149 Interior',                 chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',    dot: 'bg-amber-400'   },
  { value: '$249 Full Detail',              label: '$249 Full Detail',              chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30', dot: 'bg-violet-400'  },
]

export function packageOption(value?: string | null): PackageOption | undefined {
  return PACKAGE_OPTIONS.find(o => o.value === value)
}
