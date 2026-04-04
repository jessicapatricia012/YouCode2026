/** Slider index → max distance in km, or null = no radius limit. Below 25 km, steps are +5. */
export const RADIUS_SLIDER_STEPS_KM = [
  null,
  5,
  10,
  15,
  20,
  25,
  50,
  100,
  150,
  200,
  400,
  800,
];

export function radiusStepLabel(stepIndex) {
  const km = RADIUS_SLIDER_STEPS_KM[stepIndex];
  if (km == null) return 'All of BC';
  return `Within ${km} km`;
}
