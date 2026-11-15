// Leaflet (+ react-leaflet and its CSS) is only downloaded when a map is actually shown.
import { lazy, Suspense, type ComponentProps } from 'react';

const Impl = lazy(() => import('./MapView').then((m) => ({ default: m.MapView })));
type Props = ComponentProps<typeof Impl>;

/** Drop-in replacement for MapView that code-splits Leaflet; reserves the map's height while it loads. */
export function MapView(props: Props) {
  return (
    <Suspense fallback={<div className={`map route-fallback ${props.tall ? 'tall' : ''}`} role="status" aria-label="Loading map" />}>
      <Impl {...props} />
    </Suspense>
  );
}
