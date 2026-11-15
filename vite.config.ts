import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Vendor libraries get their own long-cacheable chunks; Leaflet and framer-motion only load with the routes that use them. */
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
  if (/node_modules\/(leaflet|react-leaflet|@react-leaflet)\//.test(id)) return 'leaflet';
  if (/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion';
  if (/node_modules\/(recharts|recharts-scale|react-smooth|victory-vendor|d3-[a-z-]+|internmap|decimal\.js-light|eventemitter3|lodash|react-is|tiny-invariant|clsx|fast-equals|dom-helpers|react-transition-group|prop-types)\//.test(id)) return 'recharts';
  return undefined;
}

/**
 * Start downloading the data the first screen needs in parallel with the app chunk instead of after it:
 * the FAOSTAT price table always, and the archived snapshot of the demo farm the visitor will see
 * (the default demo on a first visit, otherwise the saved active demo; nothing for custom farms).
 */
function preloadFirstScreenData(): Plugin {
  return {
    name: 'field-shift-preload-data',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const chunkFor = (suffix: string) => Object.values(ctx.bundle!).find((c) => c.type === 'chunk' && c.facadeModuleId?.endsWith(suffix))?.fileName;
        const fao = chunkFor('src/data/faostat/countries.json');
        const demos = { 'demo-bambey': chunkFor('src/data/demo/bambey.json'), 'demo-kostanay': chunkFor('src/data/demo/kostanay.json') };
        const tags: string[] = [];
        if (fao) tags.push(`<link rel="modulepreload" crossorigin href="./${fao}" />`);
        if (demos['demo-bambey']) {
          tags.push(`<script>(function(){var a=null;try{a=localStorage.getItem('fieldshift:v1:active')}catch(e){}var m=${JSON.stringify(demos)};var f=m[a||'demo-bambey'];if(!f)return;var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href='./'+f;document.head.appendChild(l)})()</script>`);
        }
        return html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
      },
    },
  };
}

// `base` is relative so the static build works on GitHub Pages sub-paths and any static host.
export default defineConfig({
  base: './',
  plugins: [react(), preloadFirstScreenData()],
  // JSON.parse of a string literal is much faster to evaluate than an equivalent JS object literal.
  json: { stringify: true },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks: vendorChunk } },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] },
} as any);
