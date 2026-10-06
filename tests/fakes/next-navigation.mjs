export function redirect(path) {
  throw new Error(`redirect:${path}`);
}
