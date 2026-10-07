import {
  FlexWidget,
  registerWidgetTaskHandler,
  requestWidgetUpdate,
  SvgWidget,
  TextWidget,
  type HexColor,
} from 'react-native-android-widget';

import { colors } from '@/constants/theme';
import { LIVE_STALE_MS, loadSnapshot, type HeartRateSnapshot } from '../heartRateWidget';

/**
 * The widget's drawing. Only loaded when the build has the widget library (see heartRateWidget.ts).
 * Widgets can't run React Native views, only the library's simple boxes, text and SVG, and they
 * take hex colors, so theme colors are cast here.
 */

const WIDGET = 'HeartRate';
const OPEN_LIVE = { clickAction: 'OPEN_URI', clickActionData: { uri: 'myfitness://live' } } as const;
const hex = (c: string) => c as HexColor;
const BACKGROUND = hex('#141211');

function zoneColor(zone: number): string {
  return zone === 0 ? colors.text : colors.hrZones[zone - 1];
}

/** "20:31", or "Mon 20:31" for an older day. */
function when(time: number): string {
  const d = new Date(time);
  const clock = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? clock : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${clock}`;
}

/** The last 30 minutes as a line with a soft fill, broken where there were no readings. */
function sparkline(trace: (number | null)[], width: number, height: number, color: string): string {
  const values = trace.filter((v): v is number => v != null);
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  const x = (i: number) => (i / Math.max(trace.length - 1, 1)) * width;
  const y = (v: number) => 2 + (1 - (v - min) / (max - min)) * (height - 4);
  const runs: { x: number; y: number }[][] = [];
  trace.forEach((v, i) => {
    if (v == null) return;
    const point = { x: x(i), y: y(v) };
    if (i > 0 && trace[i - 1] != null) runs.at(-1)!.push(point);
    else runs.push([point]);
  });
  const line = runs.map((r) => `M${r.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`).join(' ');
  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => `M${r[0].x.toFixed(1)},${height} L${r.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} L${r.at(-1)!.x.toFixed(1)},${height} Z`)
    .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
<path d="${area}" fill="url(#f)"/>
<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

export function HeartRateWidget({ snapshot, width, height }: { snapshot: HeartRateSnapshot | null; width: number; height: number }) {
  const live = !!snapshot?.live && Date.now() - snapshot.time < LIVE_STALE_MS;
  const color = snapshot && live ? zoneColor(snapshot.zone) : colors.text;
  const chartWidth = Math.max(width - 28, 40);
  const chartHeight = Math.max(height - 96, 0);
  const hasTrace = !!snapshot && snapshot.trace.filter((v) => v != null).length > 1;

  return (
    <FlexWidget
      {...OPEN_LIVE}
      style={{ width: 'match_parent', height: 'match_parent', backgroundColor: BACKGROUND, borderRadius: 22, padding: 14, flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="♥ HEART RATE" style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 0.08, color: hex(colors.restingHr) }} />
        <TextWidget
          text={!snapshot ? '' : live ? '● LIVE' : when(snapshot.time)}
          style={{ fontSize: 11, fontWeight: 'bold', color: hex(live ? colors.recovery.green : colors.muted) }}
        />
      </FlexWidget>

      {snapshot ? (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <TextWidget text={String(snapshot.bpm)} style={{ fontSize: 44, fontFamily: 'BarlowCondensed_700Bold', color: hex(color) }} />
          <TextWidget
            text={live ? `  bpm · ${snapshot.zone === 0 ? 'everyday' : `zone ${snapshot.zone}`}` : '  bpm · last reading'}
            style={{ fontSize: 12, color: hex(colors.muted), marginBottom: 8 }}
          />
        </FlexWidget>
      ) : (
        <TextWidget text="No reading yet" style={{ fontSize: 18, fontWeight: 'bold', color: hex(colors.text) }} />
      )}

      {chartHeight >= 16 && hasTrace ? (
        <SvgWidget svg={sparkline(snapshot!.trace, chartWidth, chartHeight, color)} style={{ width: chartWidth, height: chartHeight }} />
      ) : live ? null : (
        <TextWidget text="Tap to start live heart rate" style={{ fontSize: 12, color: hex(colors.muted) }} />
      )}
    </FlexWidget>
  );
}

export async function drawHeartRateWidget(snapshot: HeartRateSnapshot) {
  await requestWidgetUpdate({
    widgetName: WIDGET,
    renderWidget: (info) => <HeartRateWidget snapshot={snapshot} width={info.width} height={info.height} />,
  });
}

/** Android asks for a redraw when the widget is added, resized and every 30 minutes, app open or not. */
export function registerHeartRateWidget() {
  registerWidgetTaskHandler(async ({ widgetAction, widgetInfo, renderWidget }) => {
    if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
    const snapshot = await loadSnapshot();
    renderWidget(<HeartRateWidget snapshot={snapshot} width={widgetInfo.width} height={widgetInfo.height} />);
  });
}
