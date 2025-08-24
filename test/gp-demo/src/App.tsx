// src/App.tsx
// (UI: hyperparameters + legend above the plot; keeps click-anywhere via near-transparent heatmap)
import { useMemo, useState } from "react";
import Plot from "react-plotly.js";
import type { Layout, LayoutAxis, Data } from "plotly.js";
import { Matrix, CholeskyDecomposition } from "ml-matrix";
import { nelderMead } from "fmin";

/**
 * --- Gaussian Process core (RBF kernel) ---
 * Numerical linear algebra via ml-matrix.
 */

const JITTER = 1e-10; // small diagonal jitter to stabilise decompositions

function rbfKernel(X: Matrix, Z: Matrix, sigma2: number, ell: number): Matrix {
  // X: n x 1, Z: m x 1 (demo is 1D; generalise by using squared row distances)
  const n = X.rows;
  const m = Z.rows;
  const out = Matrix.zeros(n, m);
  const inv2ell2 = 0.5 / (ell * ell);
  for (let i = 0; i < n; i++) {
    const xi = X.get(i, 0);
    for (let j = 0; j < m; j++) {
      const dz = xi - Z.get(j, 0);
      out.set(i, j, sigma2 * Math.exp(-(dz * dz) * inv2ell2));
    }
  }
  return out;
}

class GP {
  private X = new Matrix(0, 1);
  private y = new Matrix(0, 1);
  private sigma2 = 0.25; // signal variance (σ²)
  private ell = 1.0;     // length-scale (ℓ)
  private noise = 1e-3;  // observation noise variance (σₙ²)

  private chol: CholeskyDecomposition | null = null;
  private alpha: Matrix | null = null; // K^{-1} y (cached)

  setData(x: number[], y: number[]) {
    this.X = Matrix.columnVector(x);
    this.y = Matrix.columnVector(y);
    this.invalidate();
  }

  setHyperparams({ sigma2, ell, noise }: { sigma2?: number; ell?: number; noise?: number }) {
    if (sigma2 !== undefined) {
      this.sigma2 = Math.min(Math.max(sigma2, 1e-2), 10.0); // σ² between 0.0001 and 10
    }
    if (ell !== undefined) {
      this.ell = Math.min(Math.max(ell, 0.1), 10.0);          // ℓ between 0.1 and 5
    }
    if (noise !== undefined) {
      this.noise = Math.min(Math.max(noise, 1e-8), 1e-2);     // σₙ² between 1e-6 and 1
    }
    this.invalidate();
  }

  private invalidate() {
    this.chol = null;
    this.alpha = null;
  }

  private ensureFactorised() {
    if (this.chol) return;
    if (this.X.rows === 0) throw new Error("No data");
    const Kff = rbfKernel(this.X, this.X, this.sigma2, this.ell);
    for (let i = 0; i < Kff.rows; i++) {
      Kff.set(i, i, Kff.get(i, i) + this.noise + JITTER);
    }
    this.chol = new CholeskyDecomposition(Kff);
    this.alpha = this.chol.solve(this.y); // K^{-1} y via triangular solves
  }

  /** Predict latent f at X*; returns mean and variance (diag). */
  predict(xstar: number[]): { mean: number[]; variance: number[] } {
    // Prior prediction when no data
    if (this.X.rows === 0) {
      const m = xstar.length;
      return {
        mean: new Array(m).fill(0),
        variance: new Array(m).fill(this.sigma2),
      };
    }

    if (xstar.length === 0) return { mean: [], variance: [] };
    this.ensureFactorised();
    const Xs = Matrix.columnVector(xstar);
    const Kxs = rbfKernel(this.X, Xs, this.sigma2, this.ell); // n x m
    const alpha = this.alpha!;                                 // n x 1

    // mean: K_*^T alpha
    const mean = Kxs.transpose().mmul(alpha).to1DArray();

    // var: k(x*,x*) - k_*^T K^{-1} k_* (diagonal only)
    const w = this.chol!.solve(Kxs); // solves K w = Kxs (multi-RHS)
    const m = Xs.rows;
    const variance = new Array<number>(m);
    for (let j = 0; j < m; j++) {
      let quad = 0;
      for (let i = 0; i < w.rows; i++) quad += Kxs.get(i, j) * w.get(i, j);
      const kxx = this.sigma2; // RBF: k(x,x) = σ²
      variance[j] = Math.max(kxx - quad, 0);
    }

    return { mean, variance };
  }

  /** Negative log marginal likelihood for optimisation. */
  nLML(): number {
    this.ensureFactorised();
    // ml-matrix exposes L through internal fields; handle both names for compatibility
    const L: Matrix =
      (this.chol as any).lowerTriangularMatrix || (this.chol as any).L;
    const alpha = this.alpha!; // n x 1
    const yAlpha = this.y.transpose().mmul(alpha).get(0, 0);

    // log|K| = 2 * sum(log(diag(L)))
    let logdet = 0;
    for (let i = 0; i < L.rows; i++) logdet += Math.log(Math.max(L.get(i, i), 1e-300));
    const n = this.X.rows;
    return 0.5 * yAlpha + logdet + 0.5 * n * Math.log(2 * Math.PI);
  }

  /** Optimise log-hyperparameters (log σ, log ℓ, log σₙ) via Nelder–Mead. */
  optimise(initial: [number, number, number], iters = 10) {
    if (this.X.rows === 0) return initial;
    const objective = (v: number[]) => {
      const [ls, ll, ln] = v;
      this.setHyperparams({
        sigma2: Math.exp(2 * ls),
        ell: Math.exp(ll),
        noise: Math.exp(2 * ln),
      });
      return this.nLML();
    };
    const res = nelderMead(objective, initial, { maxIterations: iters });
    const [ls, ll, ln] = res.x as [number, number, number];
    this.setHyperparams({ sigma2: Math.exp(2 * ls), ell: Math.exp(ll), noise: Math.exp(2 * ln) });
    return [ls, ll, ln] as [number, number, number];
  }

  get hyper() {
    return { sigma2: this.sigma2, ell: this.ell, noise: this.noise };
  }
}

/**
 * --- Utilities ---
 */
function linspace(a: number, b: number, n: number) {
  const out = new Array<number>(n);
  const h = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + i * h;
  return out;
}

function toFixedSmart(x: number) {
  if (!isFinite(x)) return String(x);
  const e = Math.log10(Math.abs(x) + 1e-16);
  const dp = e < -2 || e > 4 ? 4 : 6;
  return x.toFixed(dp);
}

/**
 * --- Demo component ---
 */
export default function App() {
  // Domain used for plotting and click-capture
  const Xmin = -10, Xmax = 10;
  const Ymin = -4, Ymax = 4; // broad vertical range to allow adding points anywhere

  // Initial synthetic dataset
  const [x, setX] = useState<number[]>(() => [-3.5, -2, -0.5, 1.0, 2.5, 3.8]);
  const [y, setY] = useState<number[]>(() =>
    x.map((xi) => Math.sin(xi) + 0.15 * (Math.random() - 0.5))
  );

  // Log-parameter sliders (optimise in log-space; σ and σₙ are std. devs.)
  const [logSigma, setLogSigma] = useState(Math.log(Math.sqrt(0.25))); // log σ
  const [logEll, setLogEll] = useState(Math.log(1.0));                 // log ℓ
  const [logNoise, setLogNoise] = useState(Math.log(Math.sqrt(1e-3))); // log σₙ

  const sigma = Math.exp(logSigma);
  const ell = Math.exp(logEll);
  const noise = Math.exp(logNoise);

  const [optimising, setOptimising] = useState(false);
  //const [clickToAdd, setClickToAdd] = useState(true);

  // GP instance (memoised)
  const gp = useMemo(() => new GP(), []);
  gp.setData(x, y);
  gp.setHyperparams({ sigma2: sigma * sigma, ell, noise: noise * noise });

  // Prediction grid
  const Xgrid = useMemo(() => linspace(Xmin, Xmax, 400), []);
  const pred = gp.predict(Xgrid);

  const bandUpper = pred.mean.map((m, i) => m + 2 * Math.sqrt(Math.max(pred.variance[i], 0)));
  const bandLower = pred.mean.map((m, i) => m - 2 * Math.sqrt(Math.max(pred.variance[i], 0)));

  const addPointAt = (x0: number, y0: number) => {
    const xs = x.slice();
    const ys = y.slice();
    xs.push(x0);
    ys.push(y0);
    setX(xs);
    setY(ys);
  };

  // Click-to-add (heatmap overlay captures clicks anywhere inside axes)
  const handleClick = (ev: any) => {
    //if (!clickToAdd) return;
    const pt = ev?.points?.[0];
    if (!pt) return;
    const x0 = Number(pt.x);
    const y0 = Number(pt.y);
    if (isFinite(x0) && isFinite(y0)) addPointAt(x0, y0);
  };

  const resetData = () => {
    setX([]); // leave empty so prior is shown and click-to-add remains active
    setY([]);
    setLogSigma(Math.log(Math.sqrt(0.25)));
    setLogEll(Math.log(1.0));
    setLogNoise(Math.log(Math.sqrt(1e-3)));
  };

  const optimise = () => {
    setOptimising(true);
    try {
      const [ls, ll, ln] = gp.optimise([logSigma, logEll, logNoise], 120);
      setLogSigma(ls);
      setLogEll(ll);
      setLogNoise(ln);
    } catch (e) {
      console.error(e);
    } finally {
      setOptimising(false);
    }
  };

  // --- Typed Plotly config ---
  const layout: Partial<Layout> = {
    autosize: true,
    height: 520,
    margin: { l: 40, r: 10, t: 10, b: 40 },
    xaxis: { title: { text: "x" }, range: [Xmin, Xmax] } as Partial<LayoutAxis>,
    yaxis: { title: { text: "y" }, range: [Ymin, Ymax] } as Partial<LayoutAxis>,
    hovermode: "closest",
    clickmode: "event",
    dragmode: false,
    showlegend: false, // hide in-plot legend; we render a custom one above
  };

  // --- Invisible heatmap for click capture over the whole domain (render last, nearly transparent) ---
  const Ygrid = useMemo(() => linspace(Ymin, Ymax, 300), []);
  const Zzeros: number[][] = useMemo(
    () => Ygrid.map(() => Xgrid.map(() => 0)),
    [Xgrid, Ygrid]
  );

  const bandColor = "rgba(31, 119, 180, 0.2)"; // subtle blue for band fill
  const meanColor = "#1f77b4";                  // Plotly default blue
  const dataColor = "#111111";

  const data: Data[] = [
    // 1) 95% credible band
    {
      x: [...Xgrid, ...Xgrid.slice().reverse()],
      y: [...bandUpper, ...bandLower.slice().reverse()],
      type: "scatter",
      mode: "lines",
      fill: "toself",
      line: { width: 0, color: bandColor },
      name: "±2σ band",
      hoverinfo: "skip",
    } as Data,

    // 2) posterior mean
    {
      x: Xgrid,
      y: pred.mean,
      type: "scatter",
      mode: "lines",
      line: { width: 2, color: meanColor },
      name: "posterior mean",
      hoverinfo: "skip",
    } as Data,

    // 3) training points
    {
      x,
      y,
      type: "scatter",
      mode: "markers",
      marker: { color: dataColor, size: 6 },
      name: "data",
      hoverinfo: "skip",
    } as Data,

    // 4) TOPMOST: nearly-transparent heatmap that captures clicks anywhere in the axes
    {
      x: Xgrid,
      y: Ygrid,
      z: Zzeros,
      type: "heatmap",
      showscale: false,
	  name: "Add data",
      hoverinfo: "name+x+y",
      opacity: 0.001,       // must be > 0 so Plotly hit-tests it
    } as unknown as Data,
  ];

  // --- Simple, responsive header UI above the plot (iframe-friendly) ---
  const container: React.CSSProperties = { minHeight: "100vh", background: "#fff", padding: 12 };
  const shell: React.CSSProperties = { maxWidth: 960, margin: "0 auto" };

  const rowWrap: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  };

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    background: "#fff",
    fontSize: 12,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };

  const swatch = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
    width: 12, height: 12, borderRadius: 2, background: bg, ...extra,
  });

  const button: React.CSSProperties = {
    padding: "6px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#f9fafb",
    fontSize: 13,
    cursor: "pointer",
  };

  /*const numberBox: React.CSSProperties = {
    minWidth: 64,
    textAlign: "right",
    padding: "4px 8px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 13,
    background: "#fff",
  };*/

  const sliderGrid: React.CSSProperties = {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    width: "100%",
  };

  return (
    <div style={container}>
      <div style={shell}>
        {/* Header row: title, quick toggles, actions */}
        <div style={{ ...rowWrap, justifyContent: "space-between" }}>
          <strong style={{ fontSize: 16 }}>GP Example</strong>

          <div style={{ ...rowWrap }}>
            
            

            <button onClick={resetData} style={button}>Clear data</button>

            <button
              disabled={optimising || x.length === 0}
              onClick={optimise}
              style={{ ...button, background: optimising ? "#f3f4f6" : "#f9fafb" }}
            >
              {optimising ? "Optimising…" : "Optimise (LML)"}
            </button>
          </div>
        </div>

        {/* Hyperparameter box ABOVE the plot */}
        <div
          style={{
            marginTop: 8,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 12,
            background: "#fff",
          }}
        >
          {/* Compact summary row */}
          <div style={{ ...rowWrap, marginBottom: 8 }}>
            
          </div>

          {/* Sliders (responsive grid) */}
          <div style={sliderGrid}>
            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>Kernel std. dev. σ</span>
                <span>{toFixedSmart(sigma)}</span>
              </label>
              <input
                type="range"
                min={Math.log(1e-3)}
                max={Math.log(2)}
                step={0.001}
                value={logSigma}
                onChange={(e) => setLogSigma(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>Length-scale ℓ</span>
                <span>{toFixedSmart(ell)}</span>
              </label>
              <input
                type="range"
                min={Math.log(1e-3)}
                max={Math.log(20)}
                step={0.001}
                value={logEll}
                onChange={(e) => setLogEll(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>Noise std. dev. σₙ</span>
                <span>{toFixedSmart(noise)}</span>
              </label>
              <input
                type="range"
                min={Math.log(1e-5)}
                max={Math.log(1)}
                step={0.001}
                value={logNoise}
                onChange={(e) => setLogNoise(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Custom legend ABOVE the plot */}
        <div style={{ ...rowWrap, marginTop: 8 }}>
          <span style={chip}>
            <span style={swatch(bandColor, { border: "1px solid #ddd" })} />
            ±2σ band
          </span>
          <span style={chip}>
            <span style={swatch(meanColor)} />
            posterior mean
          </span>
          <span style={chip}>
            <span style={swatch(dataColor)} />
            data
          </span>
        </div>

        {/* Plot */}
        <div style={{ marginTop: 8 }}>
          <Plot
            data={data}
            layout={layout}
            config={{ responsive: true, displaylogo: false, scrollZoom: false, doubleClick: false, displayModeBar: false, staticPlot: false }}
            onClick={handleClick}
            style={{ width: "100%", height: "520px" }}
          />
        </div>
      </div>
    </div>
  );
}
