// Remotion's bundler turns .svg imports into asset URLs (type asset/resource in shared-bundler-config.js).
declare module '*.svg' {
  const url: string;
  export default url;
}
