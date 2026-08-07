export class ChartContainer extends HTMLElement {
  connectedCallback() {
    if (!this.canvas) {
      const canvas = document.createElement('canvas');
      this.appendChild(canvas);
      this.canvas = canvas;
      this.chart = null;
    }
    if (this.pendingConfig) {
      const config = this.pendingConfig;
      this.pendingConfig = null;
      this.render(config);
    }
  }

  render(config) {
    if (!this.canvas) {
      this.pendingConfig = config;
      return;
    }
    if (this.chart) {
      this.chart.destroy();
    }
    if (typeof Chart !== 'undefined') {
      this.chart = new Chart(this.canvas, config);
    }
  }

  disconnectedCallback() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
customElements.define('chart-container', ChartContainer);
