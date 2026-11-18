// @types/react-dom is not installed; ChunkRender only needs createPortal.
declare module 'react-dom' {
  export function createPortal(children: import('react').ReactNode, container: Element | DocumentFragment, key?: string | null): import('react').ReactPortal;
}
