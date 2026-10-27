/** Mask clearly non-sexual idioms for intent/policy checks, never for delivered text.
 * Sexual targets are excluded so an idiom cannot hide a directed sexual request.
 */
export function maskCasualProfanity(text: string): string {
  return text.replace(
    /\b(?:(?:what(?:\s+the)?|oh|holy)\s+fuck(?!\s+(?:me|you|her|him|us|them|my|your|his|their)\b)|for\s+fuck(?:['’]?s)?\s+sake|fuck\s+(?:this|that|work|traffic|it|yeah|yes|no|off|(?:my|your)\s+(?:commute|job|schedule|alarm|calendar))\b|fucking\s+(?!(?:you|me|my|your|her|him|his|their|us|them)\b)|(?:this|that|it)\s+(?:(?:must|will|really|totally)\s+)?sucks?(?!\s+(?:me|you|her|him|us|them|my|your|his|their)\b)\b)/gi,
    " ",
  );
}
