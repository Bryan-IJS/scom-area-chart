import {
  Module,
  customModule,
  ControlElement,
  customElements,
  Container,
  IDataSchema,
  HStack,
  Label,
  VStack,
  Styles,
  Panel,
  LineChart,
  moment
} from '@ijstech/components';
import { PageBlock, IAreaChartConfig, callAPI, formatNumber, groupByCategory, extractUniqueTimes, concatUnique, groupArrayByKey, formatNumberByFormat } from './global/index';
import { chartStyle, containerStyle } from './index.css';
import assets from './assets';
const Theme = Styles.Theme.ThemeVars;

interface ScomAreaChartElement extends ControlElement {
  data: IAreaChartConfig
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ['i-scom-area-chart']: ScomAreaChartElement;
    }
  }
}

@customModule
@customElements('i-scom-area-chart')
export default class ScomAreaChart extends Module implements PageBlock {
  private chartContainer: VStack;
  private vStackInfo: HStack;
  private pnlChart: Panel;
  private loadingElm: Panel;
  private lbTitle: Label;
  private lbDescription: Label;
  private chartData: { [key: string]: string | number }[] = [];
  private apiEndpoint = '';

  private _oldData: IAreaChartConfig = { apiEndpoint: '', options: undefined };
  private _data: IAreaChartConfig = { apiEndpoint: '', options: undefined };
  private oldTag: any = {};
  tag: any = {};
  defaultEdit: boolean = true;
  readonly onConfirm: () => Promise<void>;
  readonly onDiscard: () => Promise<void>;
  readonly onEdit: () => Promise<void>;

  static async create(options?: ScomAreaChartElement, parent?: Container) {
    let self = new this(parent, options);
    await self.ready();
    return self;
  }

  constructor(parent?: Container, options?: ScomAreaChartElement) {
    super(parent, options);
  }

  getData() {
    return this._data;
  }

  async setData(data: IAreaChartConfig) {
    this._oldData = this._data;
    this._data = data;
    this.updateChartData();
  }

  getTag() {
    return this.tag;
  }

  async setTag(value: any) {
    this.tag = value || {};
    this.width = this.tag.width || 700;
    this.height = this.tag.height || 500;
    this.onUpdateBlock();
  }

  getConfigSchema() {
    return this.getThemeSchema();
  }

  onConfigSave(config: any) {
    this.tag = config;
    this.onUpdateBlock();
  }

  async edit() {
    // this.chartContainer.visible = false
  }

  async confirm() {
    this.onUpdateBlock();
    // this.chartContainer.visible = true
  }

  async discard() {
    // this.chartContainer.visible = true
  }

  async config() { }

  private getPropertiesSchema(readOnly?: boolean) {
    const propertiesSchema = {
      type: 'object',
      properties: {
        apiEndpoint: {
          type: 'string',
          title: 'API Endpoint',
          required: true
        },
        options: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              required: true
            },
            description: {
              type: 'string'
            },
            options: {
              type: 'object',
              properties: {
                xColumn: {
                  type: 'object',
                  title: 'X column',
                  required: true,
                  properties: {
                    key: {
                      type: 'string',
                      required: true
                    },
                    type: {
                      type: 'string',
                      enum: ['time', 'category'],
                      required: true
                    }
                  }
                },
                yColumns: {
                  type: 'array',
                  title: 'Y columns',
                  required: true,
                  items: {
                    type: 'string'
                  }
                },
                groupBy: {
                  type: 'string'
                },
                smooth: {
                  type: 'boolean'
                },
                stacking: {
                  type: 'boolean'
                },
                legend: {
                  type: 'boolean',
                  title: 'Show Chart Legend'
                },
                showSymbol: {
                  type: 'boolean'
                },
                showDataLabels: {
                  type: 'boolean'
                },
                percentage: {
                  type: 'boolean'
                },
                xAxis: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string'
                    },
                    tickFormat: {
                      type: 'string'
                    },
                    reverseValues: {
                      type: 'boolean'
                    }
                  }
                },
                yAxis: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string'
                    },
                    tickFormat: {
                      type: 'string'
                    },
                    labelFormat: {
                      type: 'string'
                    },
                    position: {
                      type: 'string',
                      enum: ['left', 'right']
                    }
                  }
                },
                seriesOptions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: {
                        type: 'string',
                        required: true
                      },
                      title: {
                        type: 'string'
                      },
                      color: {
                        type: 'string',
                        format: 'color'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return propertiesSchema as IDataSchema;
  }

  private getThemeSchema(readOnly?: boolean) {
    const themeSchema = {
      type: 'object',
      properties: {
        darkShadow: {
          type: 'boolean'
        },
        fontColor: {
          type: 'string',
          format: 'color'
        },
        backgroundColor: {
          type: 'string',
          format: 'color'
        },
        width: {
          type: 'string'
        },
        height: {
          type: 'string'
        }
      }
    }
    return themeSchema as IDataSchema;
  }

  getEmbedderActions() {
    return this._getActions(this.getPropertiesSchema(true), this.getThemeSchema(true));
  }

  getActions() {
    return this._getActions(this.getPropertiesSchema(), this.getThemeSchema());
  }

  _getActions(propertiesSchema: IDataSchema, themeSchema: IDataSchema) {
    const actions = [
      {
        name: 'Settings',
        icon: 'cog',
        command: (builder: any, userInputData: any) => {
          return {
            execute: async () => {
              if (builder?.setData) {
                builder.setData(userInputData);
              }
              this.setData(userInputData);
            },
            undo: () => {
              if (builder?.setData) {
                builder.setData(this._oldData);
              }
              this.setData(this._oldData);
            },
            redo: () => { }
          }
        },
        userInputDataSchema: propertiesSchema,
        userInputUISchema: {
          type: 'VerticalLayout',
          elements: [
            {
              type: 'Control',
              scope: '#/properties/apiEndpoint',
              title: 'API Endpoint'
            },
            {
              type: 'Control',
              scope: '#/properties/options/properties/title'
            },
            {
              type: 'Control',
              scope: '#/properties/options/properties/description'
            },
            {
              type: 'Control',
              scope: '#/properties/options/properties/options',
              options: {
                detail: {
                  type: 'VerticalLayout'
                }
              }
            }
          ]
        }
      },
      {
        name: 'Theme Settings',
        icon: 'palette',
        command: (builder: any, userInputData: any) => {
          return {
            execute: async () => {
              if (!userInputData) return;
              this.oldTag = { ...this.tag };
              this.setTag(userInputData);
              if (builder) builder.setTag(userInputData);
            },
            undo: () => {
              if (!userInputData) return;
              this.setTag(this.oldTag);
              if (builder) builder.setTag(this.oldTag);
            },
            redo: () => { }
          }
        },
        userInputDataSchema: themeSchema
      }
    ]
    return actions
  }

  private updateStyle(name: string, value: any) {
    value ? this.style.setProperty(name, value) : this.style.removeProperty(name);
  }

  private updateTheme() {
    if (this.chartContainer) {
      this.chartContainer.style.boxShadow = this.tag?.darkShadow ? '0 -2px 10px rgba(0, 0, 0, 1)' : 'rgba(0, 0, 0, 0.16) 0px 1px 4px';
    }
    this.updateStyle('--text-primary', this.tag?.fontColor);
    this.updateStyle('--background-main', this.tag?.backgroundColor);
  }

  private onUpdateBlock() {
    this.renderChart();
    this.updateTheme();
  }

  private async updateChartData() {
    if (this._data.apiEndpoint === this.apiEndpoint) {
      this.onUpdateBlock();
      return;
    }
    const apiEndpoint = this._data.apiEndpoint;
    this.apiEndpoint = apiEndpoint;
    if (apiEndpoint) {
      this.loadingElm.visible = true;
      const data = await callAPI(apiEndpoint);
      this.loadingElm.visible = false;
      if (data && this._data.apiEndpoint === apiEndpoint) {
        this.chartData = data;
        this.onUpdateBlock();
        return;
      }
    }
    this.chartData = [];
    this.onUpdateBlock();
  }

  private renderChart() {
    if (!this.pnlChart && this._data.options) return;
    const { title, description, options } = this._data.options;
    this.lbTitle.caption = title;
    this.lbDescription.caption = description;
    this.lbDescription.visible = !!description;
    this.pnlChart.height = `calc(100% - ${this.vStackInfo.offsetHeight + 10}px)`;
    const { xColumn, yColumns, groupBy, seriesOptions, smooth, stacking, legend, showSymbol, showDataLabels, percentage, xAxis, yAxis } = options;
    const { key, type } = xColumn;
    let _series = [];
    let arr = this.chartData;
    const item = (arr && arr[0]) || {};
    if (groupBy && item[groupBy] !== undefined) {
      const group = groupByCategory(arr, groupBy, key, yColumns[0]);
      const times = extractUniqueTimes(arr, key);
      let groupData: { [key: string]: any[] } = {};
      const keys = Object.keys(group);
      keys.map(v => {
        const _data = concatUnique(times, group[v]);
        groupData[v] = groupArrayByKey(Object.keys(_data).map(m => [type === 'time' ? new Date(m) : m, _data[m]]));
      });
      const isPercentage = percentage && groupData[keys[0]] && typeof groupData[keys[0]][0][1] === 'number';
      _series = keys.map(v => {
        const seriesOpt = seriesOptions?.find(f => f.key === v);
        let _data = [];
        if (isPercentage) {
          _data = groupData[v].map((vals, idx) => {
            let total = 0;
            for (const k of keys) {
              total += groupData[k][idx][1];
            }
            return [vals[0], (vals[1] / total) * 100];
          });
        } else {
          _data = groupData[v];
        }
        return {
          name: seriesOpt?.title || v,
          type: 'line',
          stack: stacking,
          smooth: smooth,
          itemStyle: seriesOpt?.color ? { color: seriesOpt.color } : undefined,
          lineStyle: {
            border: 'transparent',
            width: 0
          },
          areaStyle: {},
          emphasis: {
            focus: 'series'
          },
          showSymbol: !!showSymbol,
          label: showDataLabels ? {
            show: true,
            formatter: function (params: any) {
              return formatNumber(params.value);
            }
          } : undefined,
          data: _data
        }
      });
    } else {
      let groupData: { [key: string]: any[] } = {};
      let isPercentage = percentage && arr.length > 0;
      yColumns.map(col => {
        if (isPercentage && typeof arr[0][col] !== 'number') {
          isPercentage = false;
        }
        groupData[col] = groupArrayByKey(arr.map(v => [type === 'time' ? new Date(v[key]) : col, v[col]]));
      });
      _series = yColumns.map((col) => {
        let _data = [];
        const seriesOpt = seriesOptions?.find(f => f.key === col);
        if (isPercentage) {
          _data = groupData[col].map((vals, idx) => {
            let total = 0;
            for (const k of yColumns) {
              total += groupData[k][idx][1];
            }
            return [vals[0], (vals[1] / total) * 100];
          });
        } else {
          _data = groupData[col];
        }
        return {
          name: seriesOpt?.title || col,
          type: 'line',
          stack: stacking,
          smooth: smooth,
          itemStyle: seriesOpt?.color ? { color: seriesOpt.color } : undefined,
          lineStyle: {
            border: 'transparent',
            width: 0
          },
          areaStyle: {},
          emphasis: {
            focus: 'series'
          },
          showSymbol: !!showSymbol,
          label: showDataLabels ? {
            show: true,
            formatter: function (params: any) {
              return formatNumber(params.value);
            }
          } : undefined,
          data: _data
        }
      });
    }
    let min = 0, max = 0;
    const isSingle = _series.length === 1;
    if (isSingle) {
      const arr = _series[0].data.filter(v => v[1] !== null).map(v => v[1]);
      min = Math.min(...arr);
      max = Math.max(...arr);
      const step = (max - min) / 5;
      min = min > step ? min - step : min;
      max += step;
    }
    const minInterval = (max - min) / 4;
    const power = Math.pow(10, Math.floor(Math.log10(minInterval)));
    const roundedInterval = Math.ceil(minInterval / power) * power;
    const _chartData: any = {
      tooltip: {
        trigger: 'axis',
        position: function (point: any, params: any, dom: any, rect: any, size: any) {
          var x = point[0];
          var y = point[1];
          var viewWidth = document.documentElement.clientWidth;
          var viewHeight = document.documentElement.clientHeight;
          var boxWidth = size.contentSize[0];
          var boxHeight = size.contentSize[1];
          // calculate x position of tooltip
          if (x + boxWidth > viewWidth) {
            x = x - boxWidth;
          }
          // calculate y position of tooltip
          if (y + boxHeight > viewHeight) {
            y = y - boxHeight;
          }
          if (x < 0) x = 0;
          if (y < 0) y = 0;
          return [x, y];
        },
        formatter: (params: any) => {
          let res = `<b>${xColumn.type === 'time' ? moment(params[0].axisValue).format('YYYY-MM-DD HH:mm') : params[0].axisValue}</b>`;
          if (_series.length === 1) {
            res += `<div style="display: flex; justify-content: space-between; gap: 10px"><span>${params[0].marker} ${params[0].seriesName}</span> ${params[0].value[1] === null ? '-' : percentage ? formatNumber(params[0].value[1], { percentValues: true }) : formatNumberByFormat(params[0].value[1], yAxis?.labelFormat ? yAxis.labelFormat : undefined)}</div>`;
          } else {
            for (const param of params) {
              if (param.value[1] !== null) {
                res += `<div style="display: flex; justify-content: space-between; gap: 10px"><span>${param.marker} ${param.seriesName}</span> ${percentage ? formatNumber(param.value[1], { percentValues: true }) : formatNumberByFormat(param.value[1], yAxis?.labelFormat ? yAxis.labelFormat : undefined)}</div>`;
              }
            }
          }
          return res;
        },
        axisPointer: {
          type: 'cross',
          label: {
            show: false
          }
        }
      },
      legend: {
        show: legend
      },
      xAxis: {
        type: type,
        boundaryGap: false,
        inverse: xAxis?.reverseValues,
        name: xAxis?.title || '',
        nameLocation: 'center',
        nameGap: xAxis?.title ? 25 : 15,
        nameTextStyle: {
          fontWeight: 'bold'
        },
        axisLabel: {
          fontSize: 10,
          formatter: xAxis?.tickFormat ? (value: number, index: number) => {
            if (type === 'time') {
              return moment(value).format(xAxis.tickFormat)
            } else {
              if (isNaN(value)) return value;
              return formatNumber(value, { format: xAxis.tickFormat, decimals: 2 })
            }
          } : undefined
        }
      },
      yAxis: {
        type: 'value',
        name: yAxis?.title || '',
        nameLocation: 'center',
        nameGap: yAxis?.title ? 40 : 15,
        nameTextStyle: {
          fontWeight: 'bold'
        },
        position: yAxis?.position || 'left',
        min: isSingle ? min : undefined,
        max: isSingle ? max : undefined,
        interval: isSingle ? roundedInterval : undefined,
        axisLabel: {
          showMinLabel: false,
          showMaxLabel: false,
          fontSize: 10,
          position: 'end',
          formatter: (value: number, index: number) => {
            return formatNumber(value, { format: yAxis?.tickFormat, decimals: 2, percentValues: percentage })
          }
        },
        splitNumber: 4
      },
      series: _series
    };
    this.pnlChart.clearInnerHTML();
    const chart = new LineChart(this.pnlChart, {
      data: _chartData,
      width: '100%',
      height: '100%'
    });
    chart.data = _chartData;
    chart.drawChart();
  }

  private resizeChart() {
    if (this.pnlChart) {
      (this.pnlChart.firstChild as LineChart)?.resize();
    }
  }

  async init() {
    this.isReadyCallbackQueued = true;
    this.updateTheme();
    super.init();
    this.classList.add(chartStyle);
    const { width, height, darkShadow } = this.tag || {};
    this.width = width || 700;
    this.height = height || 500;
    this.maxWidth = '100%';
    this.chartContainer.style.boxShadow = darkShadow ? '0 -2px 10px rgba(0, 0, 0, 1)' : 'rgba(0, 0, 0, 0.16) 0px 1px 4px';
    const data = this.getAttribute('data', true);
    if (data) {
      this.setData(data);
    }
    this.isReadyCallbackQueued = false;
    this.executeReadyCallback();
    window.addEventListener('resize', () => {
      setTimeout(() => {
        this.resizeChart();
      }, 300);
    });
  }

  render() {
    return (
      <i-vstack
        id="chartContainer"
        position="relative"
        background={{ color: Theme.background.main }}
        height="100%"
        padding={{ top: 10, bottom: 10, left: 10, right: 10 }}
        class={containerStyle}
      >
        <i-vstack id="loadingElm" class="i-loading-overlay">
          <i-vstack class="i-loading-spinner" horizontalAlignment="center" verticalAlignment="center">
            <i-icon
              class="i-loading-spinner_icon"
              image={{ url: assets.fullPath('img/loading.svg'), width: 36, height: 36 }}
            />
          </i-vstack>
        </i-vstack>
        <i-vstack
          id="vStackInfo"
          width="100%"
          maxWidth="100%"
          margin={{ left: 'auto', right: 'auto', bottom: 10 }}
          verticalAlignment="center"
        >
          <i-label id="lbTitle" font={{ bold: true, color: Theme.text.primary }} />
          <i-label id="lbDescription" margin={{ top: 5 }} font={{ color: Theme.text.primary }} />
        </i-vstack>
        <i-panel id="pnlChart" width="100%" height="inherit" />
      </i-vstack>
    )
  }
}