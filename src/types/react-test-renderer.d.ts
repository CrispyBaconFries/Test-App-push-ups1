/**
 * Minimale Typen für `react-test-renderer`.
 *
 * Warum von Hand und nicht `npm i -D @types/react-test-renderer`: Das Paket selbst liegt
 * bereits im Projekt (als Abhängigkeit von react/jest-expo), nur seine Typen nicht. Ein
 * zusätzlicher Eintrag in package.json hieße ein weiteres `npm install` - und genau das
 * ist in diesem Projekt kein Selbstläufer: `postinstall` fährt `patch-package`, und die
 * gepatchten nativen Pakete sind schon mehrfach die Quelle langer Fehlersuchen gewesen.
 * Für einen reinen Typ-Bedarf in zwei Testdateien ist das der falsche Preis.
 *
 * Beschrieben ist nur, was hier tatsächlich benutzt wird. Braucht ein Test mehr, gehört
 * es hier ergänzt.
 */
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestInstance {
    props: Record<string, unknown> & { children?: unknown };
    findAllByType(type: unknown): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    toJSON(): unknown;
    unmount(): void;
    root: ReactTestInstance;
  }

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): void;

  const TestRenderer: {
    create: typeof create;
    act: typeof act;
  };
  export default TestRenderer;
}
