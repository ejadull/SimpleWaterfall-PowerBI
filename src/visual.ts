/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";
import "@babel/polyfill";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import { ITooltipServiceWrapper, createTooltipServiceWrapper, TooltipEventArgs } from "./tooltipServiceWrapper";
import ISelectionIdBuilder = powerbi.visuals.ISelectionIdBuilder;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataViewHierarchyLevel = powerbi.DataViewHierarchyLevel;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewObject = powerbi.DataViewObject;

import PrimitiveValue = powerbi.PrimitiveValue;
import * as d3 from "d3";
import {
    valueFormatter as vf,
    textMeasurementService as tms,
    valueFormatter
} from "powerbi-visuals-utils-formattingutils";
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import { VisualSettings, yAxisFormatting, chartOrientation } from "./settings";
import { dataRoleHelper } from "powerbi-visuals-utils-dataviewutils";
import { AxisScale, AxisDomain } from "d3";

/**
     * Interface for BarChart data points.
     *
     * @interface
     * @property {number} value             - Data value for point.
     * @property {string} category          - Corresponding category of data value.
     * @property {string} color             - Color corresponding to data point.
     * @property {ISelectionId} selectionId - Id assigned to data point for cross filtering
     *                                        and visual interaction.
     */
interface BarChartDataPoint {
    value: PrimitiveValue;
    numberFormat: string;
    formattedValue: string;
    originalFormattedValue: string;
    isPillar: number;
    category: string;
    color: string;
    customBarColor: string;
    customFontColor: string;
    customLabelPositioning: string;
    selectionId: ISelectionId;
    childrenCount: number;
};
export class Visual implements IVisual {

    private svg: d3.Selection<any, any, any, any>;
    private svgYAxis: d3.Selection<any, any, any, any>;
    private container: d3.Selection<any, any, any, any>;
    private gScrollable: d3.Selection<any, any, any, any>;
    private visualSettings: VisualSettings;
    private adjustmentConstant: number;
    private minValue: number;
    private maxValue: number;
    private originalwidth: number;
    private originalheight: number;
    private width: number;
    private height: number;
    private innerWidth: number;
    private innerHeight: number;
    private barChartData: BarChartDataPoint[];
    private margin;
    private host: IVisualHost;
    private selectionIdBuilder: ISelectionIdBuilder;
    private selectionManager: ISelectionManager;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private visualType: string;
    private visualUpdateOptions: VisualUpdateOptions;
    private bars: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private xAxisPosition = 0;
    private yAxisWidth = 0;
    private yAxisHeightHorizontal = 0;
    private scrollbarBreath = 0;
    private yScaleTickValues = [];
    



    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.container = d3.select<HTMLElement, any>(options.element)
            .append('div');
        this.adjustmentConstant = 0;
        this.scrollbarBreath = 8;
        this.tooltipServiceWrapper = createTooltipServiceWrapper(options.host.tooltipService, options.element);
        this.selectionIdBuilder = options.host.createSelectionIdBuilder();
        this.selectionManager = options.host.createSelectionManager();
    }
    private static parseSettings(dataView: DataView): VisualSettings {
        return VisualSettings.parse(dataView) as VisualSettings;
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        let objectName: string = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];
        if (this.visualType == "static") {
            switch (objectName) {
                case 'definePillars':
                    var isPillarBoolean: boolean;
                    for (var index = 0; index < this.barChartData.length; index++) {
                        if (this.barChartData[index].isPillar) {
                            isPillarBoolean = true;
                        } else {
                            isPillarBoolean = false;
                        }
                        objectEnumeration.push({
                            objectName: "objectName",
                            displayName: this.barChartData[index].category,
                            properties: {
                                pillars: isPillarBoolean
                            },
                            selector: this.barChartData[index].selectionId.getSelector()
                        });
                    }
            }
        }
        if (this.visualType == "staticCategory") {
            switch (objectName) {
                case 'definePillars':
                    var isPillarBoolean: boolean;
                    for (var index = 0; index < this.barChartData.length; index++) {
                        if (this.barChartData[index].isPillar) {
                            isPillarBoolean = true;
                        } else {
                            isPillarBoolean = false;
                        }
                        objectEnumeration.push({
                            objectName: "objectName",
                            displayName: this.barChartData[index].category,
                            properties: {
                                pillars: isPillarBoolean
                            },
                            selector: this.barChartData[index].selectionId.getSelector()
                        });
                    }
            }
        }
        switch (objectName) {

            case 'chartOrientation':
                if (this.visualType == "static" || this.visualType == "staticCategory") {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            orientation: this.visualSettings.chartOrientation.orientation,
                            useSentimentFeatures: this.visualSettings.chartOrientation.useSentimentFeatures
                        },
                        selector: null
                    });
                } else {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            orientation: this.visualSettings.chartOrientation.orientation
                        },
                        selector: null
                    });
                }
            case 'sentimentColor':
                if (this.visualType == "static" || this.visualType == "staticCategory") {
                    if (this.visualSettings.chartOrientation.useSentimentFeatures && (this.visualType == "static" || this.visualType == "staticCategory")) {
                        objectEnumeration.push({
                            objectName: "objectName",
                            properties: {
                                sentimentColorTotal: this.visualSettings.sentimentColor.sentimentColorTotal,
                                sentimentColorFavourable: this.visualSettings.sentimentColor.sentimentColorFavourable,
                                sentimentColorAdverse: this.visualSettings.sentimentColor.sentimentColorAdverse
                            },
                            selector: null
                        });
                    } else {
                        for (var index = 0; index < this.barChartData.length; index++) {
                            objectEnumeration.push({
                                objectName: "objectName",
                                displayName: this.barChartData[index].category,
                                properties: {
                                    fill1: {
                                        solid: {
                                            color: this.barChartData[index].customBarColor
                                        }
                                    }
                                },
                                selector: this.barChartData[index].selectionId.getSelector()
                            });

                        }
                    }
                } else {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            sentimentColorTotal: this.visualSettings.sentimentColor.sentimentColorTotal,
                            sentimentColorFavourable: this.visualSettings.sentimentColor.sentimentColorFavourable,
                            sentimentColorAdverse: this.visualSettings.sentimentColor.sentimentColorAdverse
                        },
                        selector: null
                    });
                }

                break;
            case 'xAxisFormatting':

                objectEnumeration.push({
                    objectName: "objectName",
                    properties: {
                        fontSize: this.visualSettings.xAxisFormatting.fontSize,
                        fontColor: this.visualSettings.xAxisFormatting.fontColor,
                        fontFamily: this.visualSettings.xAxisFormatting.fontFamily,
                        fitToWidth: this.visualSettings.xAxisFormatting.fitToWidth,
                        labelWrapText: this.visualSettings.xAxisFormatting.labelWrapText
                    },
                    selector: null
                });
                if (!this.visualSettings.xAxisFormatting.fitToWidth) {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            barWidth: this.visualSettings.xAxisFormatting.barWidth
                        },
                        selector: null
                    });

                    objectEnumeration[1].validValues = {
                        barWidth: { numberRange: { min: 20, max: 100 } }

                    };
                }

                objectEnumeration.push({
                    objectName: "objectName",
                    properties: {
                        padding: this.visualSettings.xAxisFormatting.padding,
                        showGridLine: this.visualSettings.xAxisFormatting.showGridLine
                    },
                    selector: null
                });
                objectEnumeration[objectEnumeration.length - 1].validValues = {
                    padding: { numberRange: { min: 0, max: 20 } }

                };

                if (this.visualSettings.xAxisFormatting.showGridLine) {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            gridLineStrokeWidth: this.defaultXAxisGridlineStrokeWidth(),
                            gridLineColor: {
                                solid: {
                                    color: this.visualSettings.xAxisFormatting.gridLineColor
                                }
                            }
                        },
                        selector: null
                    });
                    objectEnumeration[objectEnumeration.length - 1].validValues = {
                        gridLineStrokeWidth: { numberRange: { min: 1, max: 50 } }
                    };
                }

                break;
            case 'yAxisFormatting':
                

                objectEnumeration.push({
                    objectName: "objectName",
                    properties: {
                        show: this.visualSettings.yAxisFormatting.show,
                        YAxisDataPointOption: this.visualSettings.yAxisFormatting.YAxisDataPointOption
                    },
                    selector: null
                });

                if (this.visualSettings.yAxisFormatting.YAxisDataPointOption == "Range") {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {

                            YAxisDataPointRangeStart: this.visualSettings.yAxisFormatting.YAxisDataPointRangeStart,
                            YAxisDataPointRangeEnd: this.visualSettings.yAxisFormatting.YAxisDataPointRangeEnd
                        },
                        selector: null
                    });
                };
                objectEnumeration.push({
                    objectName: "objectName",
                    properties: {
                        fontSize: this.visualSettings.yAxisFormatting.fontSize,
                        fontColor: this.visualSettings.yAxisFormatting.fontColor,
                        YAxisValueFormatOption: this.visualSettings.yAxisFormatting.YAxisValueFormatOption,
                        showGridLine: this.visualSettings.yAxisFormatting.showGridLine
                    },
                    selector: null
                });
                if (this.visualSettings.yAxisFormatting.showGridLine) {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            gridLineStrokeWidth: this.defaultYAxisGridlineStrokeWidth(),
                            gridLineColor: {
                                solid: {
                                    color: this.visualSettings.yAxisFormatting.gridLineColor
                                }
                            }
                        },
                        selector: null
                    });
                    objectEnumeration[1].validValues = {
                        gridLineStrokeWidth: { numberRange: { min: 1, max: 10 } }

                    };
                }

                break;
            case 'LabelsFormatting':
                if (this.visualSettings.LabelsFormatting.show) {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            show: this.visualSettings.LabelsFormatting.show,
                            fontSize: this.visualSettings.LabelsFormatting.fontSize,
                            useDefaultFontColor: this.visualSettings.LabelsFormatting.useDefaultFontColor
                        },
                        selector: null
                    });

                    if (this.visualSettings.LabelsFormatting.useDefaultFontColor) {
                        objectEnumeration.push({
                            objectName: "objectName",
                            properties: {
                                fontColor: this.visualSettings.LabelsFormatting.fontColor,
                            },
                            selector: null
                        });
                    } else {

                        if (this.visualSettings.chartOrientation.useSentimentFeatures || (this.visualType != "static" && this.visualType != "staticCategory")) {
                            objectEnumeration.push({
                                objectName: "objectName",
                                properties: {
                                    sentimentFontColorTotal: this.visualSettings.LabelsFormatting.sentimentFontColorTotal,
                                    sentimentFontColorFavourable: this.visualSettings.LabelsFormatting.sentimentFontColorFavourable,
                                    sentimentFontColorAdverse: this.visualSettings.LabelsFormatting.sentimentFontColorAdverse
                                },
                                selector: null
                            });
                        } else {
                            if (this.visualType == "static" || this.visualType == "staticCategory") {
                                for (var index = 0; index < this.barChartData.length; index++) {
                                    objectEnumeration.push({
                                        objectName: "objectName",
                                        displayName: this.barChartData[index].category,
                                        properties: {
                                            fill1: {
                                                solid: {
                                                    color: this.barChartData[index].customFontColor
                                                }
                                            }
                                        },
                                        selector: this.barChartData[index].selectionId.getSelector()
                                    });
                                }
                            }
                        }
                    }
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            fontFamily: this.visualSettings.LabelsFormatting.fontFamily
                        },
                        selector: null
                    });

                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            useDefaultLabelPositioning: this.visualSettings.LabelsFormatting.useDefaultLabelPositioning,
                        },
                        selector: null
                    });
                    if (this.visualSettings.LabelsFormatting.useDefaultLabelPositioning) {
                        objectEnumeration.push({
                            objectName: "objectName",
                            properties: {
                                labelPosition: this.visualSettings.LabelsFormatting.labelPosition,
                            },
                            selector: null
                        });
                    } else {

                        if (this.visualSettings.chartOrientation.useSentimentFeatures || (this.visualType != "static" && this.visualType != "staticCategory")) {
                            objectEnumeration.push({
                                objectName: "objectName",
                                properties: {
                                    labelPositionTotal: this.visualSettings.LabelsFormatting.labelPositionTotal,
                                    labelPositionFavourable: this.visualSettings.LabelsFormatting.labelPositionFavourable,
                                    labelPositionAdverse: this.visualSettings.LabelsFormatting.labelPositionAdverse
                                },
                                selector: null
                            });
                        } else {
                            if (this.visualType == "static" || this.visualType == "staticCategory") {
                                for (var index = 0; index < this.barChartData.length; index++) {
                                    objectEnumeration.push({
                                        objectName: "objectName",
                                        displayName: this.barChartData[index].category,
                                        properties: {
                                            labelPosition: this.barChartData[index].customLabelPositioning
                                        },
                                        selector: this.barChartData[index].selectionId.getSelector()
                                    });
                                }
                            }
                        }
                    }

                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            valueFormat: this.visualSettings.LabelsFormatting.valueFormat
                        },
                        selector: null
                    });
                    /* if (this.visualSettings.LabelsFormatting.valueFormat == "Auto") {
                        objectEnumeration.push({
                            objectName: "objectName",
                            properties: {
                                negativeInBrackets: this.visualSettings.LabelsFormatting.negativeInBrackets
                            },
                            selector: null
                        });
                    } */
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            HideZeroBlankValues: this.visualSettings.LabelsFormatting.HideZeroBlankValues
                        },
                        selector: null
                    });
                } else {
                    objectEnumeration.push({
                        objectName: "objectName",
                        properties: {
                            show: this.visualSettings.LabelsFormatting.show
                        },
                        selector: null
                    });
                }
                break;
            case 'margins':
                objectEnumeration.push({
                    objectName: "objectName",
                    properties: {
                        topMargin: this.visualSettings.margins.topMargin,
                        bottomMargin: this.visualSettings.margins.bottomMargin,
                        leftMargin: this.visualSettings.margins.leftMargin,
                        rightMargin: this.visualSettings.margins.rightMargin
                    },

                    selector: null
                });

                objectEnumeration[0].validValues = {
                    topMargin: { numberRange: { min: 0, max: 100 } },
                    leftMargin: { numberRange: { min: 0, max: 50 } },
                    bottomMargin: { numberRange: { min: 0, max: 50 } },
                    rightMargin: { numberRange: { min: 0, max: 50 } }
                };
        };

        return objectEnumeration;
    }
    public update(options: VisualUpdateOptions) {
        this.visualUpdateOptions = options;
        let dataView: DataView = options.dataViews[0];
        this.visualSettings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
    
        this.container.selectAll('svg').remove();
        this.width = options.viewport.width;
        this.height = options.viewport.height;
        this.xAxisPosition = 0;
        if (dataView.matrix.rows.levels.length == 0) {
            this.visualType = "static";
            this.barChartData = this.getDataStaticWaterfall(options);
            var allData = [];
            allData.push(this.barChartData);
            this.createWaterfallGraph(options, allData);
        } else if (dataView.matrix.rows.levels.length == 1 && dataView.matrix.valueSources.length == 1) {

            this.visualType = "staticCategory";
            this.barChartData = this.getDataStaticCategoryWaterfall(options);
            var allData = [];
            allData.push(this.barChartData);
            this.createWaterfallGraph(options, allData);
            
        } else if (dataView.matrix.rows.levels.length != 1 && dataView.matrix.valueSources.length == 1) {
            this.visualType = "drillableCategory";
            var allData = this.getDataDrillableCategoryWaterfall(options);
            this.barChartData = this.getDataDrillableCategoryWaterfall(options)[allData.length - 1];
            this.createWaterfallGraph(options, allData);
            
        } else {
            this.visualType = "drillable";
            var allData = this.getDataDrillableWaterfall(options);
            this.barChartData = this.getDataDrillableWaterfall(options)[allData.length - 1];
            this.createWaterfallGraph(options, allData);
            
        }
    }

    private createWaterfallGraph(options, allData) {

        if (this.visualSettings.chartOrientation.orientation == "Horizontal") {
            this.createWaterfallGraphHorizontal(options, allData);
        } else {
            this.createWaterfallGraphVertical(options, allData);
        }


    }


    private createWaterfallGraphVertical(options, allData) {

        
        this.svgYAxis = this.container
            .append('svg');
        this.svg = this.container
            .append('svg');
        this.svg.on('contextmenu', () => {

            const mouseEvent: MouseEvent = d3.event as MouseEvent;
            const eventTarget: EventTarget = mouseEvent.target;
            let dataPoint: any = d3.select(<d3.BaseType>eventTarget).datum();
            this.selectionManager.showContextMenu(dataPoint ? dataPoint.selectionId : {}, {
                x: mouseEvent.clientX,
                y: mouseEvent.clientY
            });
            mouseEvent.preventDefault();
        });
        this.visualUpdateOptions = options;

        this.container.attr("width", this.width);
        this.container.attr("height", this.height);
        this.svg.attr("height", this.height);
        this.svgYAxis.attr("height", this.height);

        this.margin = {
            top: this.visualSettings.margins.topMargin + 20,
            right: this.visualSettings.margins.rightMargin,
            bottom: this.visualSettings.margins.bottomMargin,
            left: this.visualSettings.margins.leftMargin
        };
        this.innerWidth = this.width - this.margin.left - this.margin.right;
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;
        this.adjustmentConstant = this.findXaxisAdjustment(this.barChartData);


        this.getMinMaxValue();
        this.gScrollable = this.svg.append('g');
        this.getYaxisWidth(this.gScrollable);
        this.svgYAxis.attr("width", this.yAxisWidth);
        this.width = this.width - this.yAxisWidth - 5;
        this.svg.attr("width", this.width);
        this.checkBarWidth(options);
        this.createXaxis(this.gScrollable, options, allData);
        this.createYAxis(this.svgYAxis, 0);
        this.createYAxis(this.gScrollable, -this.yAxisWidth * 2);
        this.createBars(this.gScrollable, this.barChartData);
        this.createLabels(this.gScrollable);



    }
    private checkBarWidth(options) {

        if (!this.visualSettings.xAxisFormatting.fitToWidth) {
            this.visualUpdateOptions = options;

            var xScale = d3.scaleBand()
                .domain(this.barChartData.map(this.xValue))
                .range([0, this.innerWidth])
                .padding(0.2);

            var currentBarWidth = xScale.step();
            if (currentBarWidth < this.visualSettings.xAxisFormatting.barWidth) {
                currentBarWidth = this.visualSettings.xAxisFormatting.barWidth;
                
                var scrollBarGroup = this.svg.append('g');
                var scrollbarContainer = scrollBarGroup.append('rect')
                    .attr('width', this.innerWidth)
                    .attr('height', this.scrollbarBreath)
                    .attr('x', 0)
                    .attr('y', this.height - this.scrollbarBreath)
                    .attr('fill', '#e1e1e1')
                    .attr('opacity', 0.5)
                    .attr('rx', 4)
                    .attr('ry', 4);
                this.innerWidth = currentBarWidth * this.barChartData.length
                    + (currentBarWidth * xScale.padding());
                
                this.innerHeight = this.height - this.margin.top - this.margin.bottom - this.scrollbarBreath;
                var dragStartPosition = 0;
                var dragScrollBarXStartposition = 0;
                var scrollbarwidth = this.width * this.width / this.innerWidth;


                var scrollbar = scrollBarGroup.append('rect')
                    .attr('width', scrollbarwidth)
                    .attr('height', this.scrollbarBreath)
                    .attr('x', 0)
                    .attr('y', this.height - this.scrollbarBreath)
                    .attr('fill', '#000')
                    .attr('opacity', 0.24)
                    .attr('rx', 4)
                    .attr('ry', 4);

                var scrollBarDragBar = d3.drag()
                    .on("start", () => {
                        dragStartPosition = d3.event.x;
                        dragScrollBarXStartposition = parseInt(scrollbar.attr('x'));

                    })
                    .on("drag", () => {
                        var scrollBarMovement = d3.event.x - dragStartPosition;
                        //do not move the scroll bar beyond the x axis or after the end of the scroll bar
                        if (dragScrollBarXStartposition + scrollBarMovement >= 0 && (dragScrollBarXStartposition + scrollBarMovement + scrollbarwidth <= this.width)) {
                            scrollbar.attr('x', dragScrollBarXStartposition + scrollBarMovement);
                            this.gScrollable.attr('transform', `translate(${(dragScrollBarXStartposition + scrollBarMovement) / (this.width - scrollbarwidth) * (this.innerWidth - this.width) * -1},${0})`);
                        }
                    });
                var scrollBarVerticalWheel = d3.zoom().on("zoom", () => {

                    var zoomScrollContainerheight = parseInt(scrollbarContainer.attr('width'));
                    var zoomScrollBarMovement = d3.event.sourceEvent.deltaY / 100 * zoomScrollContainerheight / this.barChartData.length;
                    var zoomScrollBarXStartposition = parseInt(scrollbar.attr('x'));
                    var zoomScrollBarheight = parseInt(scrollbar.attr('width'));

                    var scrollBarMovement = zoomScrollBarXStartposition + zoomScrollBarMovement;
                    if (scrollBarMovement < 0) {
                        scrollBarMovement = 0;
                    }
                    if (scrollBarMovement + zoomScrollBarheight > zoomScrollContainerheight) {
                        scrollBarMovement = zoomScrollContainerheight - zoomScrollBarheight
                    }
                    scrollbar.attr('x', scrollBarMovement);
                    this.gScrollable.attr('transform', `translate(${(scrollBarMovement) / (this.width - scrollbarwidth) * (this.innerWidth - this.width) * -1},${0})`);
                });
                this.svg.call(scrollBarVerticalWheel);
                scrollBarDragBar(scrollbar);
            }
        }
    }

    private defaultYAxisGridlineStrokeWidth = () => {
        var currentgridLineStrokeWidth = 1;
        if (this.visualSettings.yAxisFormatting.gridLineStrokeWidth < 1) {
            currentgridLineStrokeWidth = 1;
        } else {
            currentgridLineStrokeWidth = this.visualSettings.yAxisFormatting.gridLineStrokeWidth;
        }
        return currentgridLineStrokeWidth;
    }
    private defaultXAxisGridlineStrokeWidth = () => {
        var currentgridLineStrokeWidth = 1;
        if (this.visualSettings.xAxisFormatting.gridLineStrokeWidth < 1) {
            currentgridLineStrokeWidth = 1;
        } else {
            currentgridLineStrokeWidth = this.visualSettings.xAxisFormatting.gridLineStrokeWidth;
        }
        return currentgridLineStrokeWidth;
    }
    private yValue = d => d.value;
    private xValue = d => d.category;

    private getMinMaxValue() {
        if (this.visualSettings.yAxisFormatting.YAxisDataPointOption == "Range"
            && this.visualSettings.yAxisFormatting.YAxisDataPointRangeStart != 0 && this.visualSettings.yAxisFormatting.YAxisDataPointRangeEnd != 0) {
            this.minValue = this.visualSettings.yAxisFormatting.YAxisDataPointRangeStart;
            this.maxValue = this.visualSettings.yAxisFormatting.YAxisDataPointRangeEnd;
        } else {
            this.minValue = this.findMinCumulativeValue(this.barChartData);
            this.maxValue = this.findMaxCumulativeValue(this.barChartData);
        }

        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerHeight, 0]);

        var ticksCount = 5;
        var staticYscaleTIcks = yScale.ticks(ticksCount);

        //realigning the xaxis to the first tick value of yaxis    
        if (this.minValue != 0) {
            if (this.minValue > 0) {
                var firstTickValueforPositive = staticYscaleTIcks[0] - (staticYscaleTIcks[1] - staticYscaleTIcks[0]);
                this.minValue = firstTickValueforPositive;
                staticYscaleTIcks.unshift(firstTickValueforPositive);
            }
            if (this.maxValue < 0) {
                var firstTickValueforNegative = staticYscaleTIcks[staticYscaleTIcks.length - 1] - (staticYscaleTIcks[staticYscaleTIcks.length - 2] - staticYscaleTIcks[staticYscaleTIcks.length - 1]);
                this.maxValue = firstTickValueforNegative;
                staticYscaleTIcks.push(firstTickValueforNegative);
            }
        }
        if (this.maxValue > 0) {
            var lastTickValueforPositive = staticYscaleTIcks[staticYscaleTIcks.length - 1] + (staticYscaleTIcks[staticYscaleTIcks.length - 1] - staticYscaleTIcks[staticYscaleTIcks.length - 2]);
            this.maxValue = lastTickValueforPositive;
            staticYscaleTIcks.push(lastTickValueforPositive);
        }
        if (this.minValue < 0) {
            var lastTickValueforNegative = staticYscaleTIcks[0] + (staticYscaleTIcks[0] - staticYscaleTIcks[1]);
            var lastTickValueforNegative2 = staticYscaleTIcks[0] + (staticYscaleTIcks[0] - staticYscaleTIcks[1]) * 2;
            //add 2 steps to have enough space between the xAxis and the labels.
            this.minValue = lastTickValueforNegative2;
            staticYscaleTIcks.unshift(lastTickValueforNegative, lastTickValueforNegative2);
        }


        this.yScaleTickValues = staticYscaleTIcks
        this.visualSettings.yAxisFormatting.YAxisDataPointRangeStart = this.minValue;
        this.visualSettings.yAxisFormatting.YAxisDataPointRangeEnd = this.maxValue;


    }
    private createYAxis(gParent, adjustLeft) {

        var g = gParent.append('g').attr('class', 'yAxisParentGroup');
        

        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerHeight, 0]);
        

        var yAxisScale = d3.axisLeft(yScale).tickValues(this.yScaleTickValues);
        

        if (this.visualSettings.yAxisFormatting.show) {
            var yAxis = g.append('g')
                .style("font", this.visualSettings.yAxisFormatting.fontSize + "px times")
                .style("font-family", this.visualSettings.yAxisFormatting.fontFamily)
                .style("color", this.visualSettings.yAxisFormatting.fontColor)
                .attr('class', 'myYaxis');

            if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Auto") {
                yAxisScale.tickFormat(d => this.myFormat_Nodp(d).replace(/G/, "B"));


            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Thousands") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 100) / 10) + "k");
            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Millions") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 100000) / 10) + "M");
            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Billions") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 10000000) / 10) + "B");
            } else {
                yAxisScale.tickFormat(d => {
                    //y-axis formatting using the formatting of the first measure        
                    let iValueFormatter = valueFormatter.create({ format: this.barChartData[0].numberFormat });
                    return iValueFormatter.format(d);
                });
            }


            
            yAxis.call(yAxisScale);



            yAxis.selectAll('path').style('fill', 'none').style('stroke', 'black').style('stroke-width', "0px");
            if (this.visualSettings.yAxisFormatting.showGridLine) {
                yAxis.selectAll('line').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor).style('stroke-width', this.defaultYAxisGridlineStrokeWidth() / 10 + "px");
            } else {
                yAxis.selectAll('line').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor).style('stroke-width', "0px");
            }

            // adjust the left margin of the chart area according to the width of yaxis             
            // yAxisWidth used to adjust the left margin
            var yAxisWidth = yAxis.node().getBoundingClientRect().width;
            var yAxisHeight = yAxis.selectAll('text').node().getBoundingClientRect().height;

            this.margin.left = this.margin.left + yAxisWidth;


            yAxis.selectAll('line').attr('x2', this.innerWidth);
        }
        var nodeWidth;
        g.attr('transform', `translate(${this.margin.left + adjustLeft},${this.margin.top})`);


    }
    private getYaxisWidth(gParent) {

        var g = gParent.append('g').attr('class', 'yAxisParentGroup');
        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerHeight, 0]);

        /*var ticksCount = 5;
        var staticYscaleTIcks = yScale.ticks(ticksCount);*/

        var yAxisScale = d3.axisLeft(yScale).tickValues(this.yScaleTickValues);

        if (this.visualSettings.yAxisFormatting.show) {
            var yAxis = g.append('g')
                .style("font", this.visualSettings.yAxisFormatting.fontSize + "px times")
                .style("font-family", this.visualSettings.yAxisFormatting.fontFamily)
                .style("color", this.visualSettings.yAxisFormatting.fontColor)
                .attr('class', 'myYaxis');

            if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Auto") {
                yAxisScale.tickFormat(d => this.myFormat_Nodp(d).replace(/G/, "B"));


            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Thousands") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 100) / 10) + "k");
            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Millions") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 100000) / 10) + "M");
            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Billions") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 10000000) / 10) + "B");
            } else {
                yAxisScale.tickFormat(d => {
                    //y-axis formatting using the formatting of the first measure        
                    let iValueFormatter = valueFormatter.create({ format: this.barChartData[0].numberFormat });
                    return iValueFormatter.format(d);
                });
            }


            
            yAxis.call(yAxisScale);



            yAxis.selectAll('path').style('fill', 'none').style('stroke', 'black').style('stroke-width', "0px");
            if (this.visualSettings.yAxisFormatting.showGridLine) {

                yAxis.selectAll('line').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor).style('stroke-width', this.defaultYAxisGridlineStrokeWidth() / 10 + "px");
            } else {
                yAxis.selectAll('line').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor).style('stroke-width', "0px");
            }

            // adjust the left margin of the chart area according to the width of yaxis             
            // yAxisWidth used to adjust the left margin
            this.yAxisWidth = yAxis.node().getBoundingClientRect().width;
            this.innerWidth = this.innerWidth - this.yAxisWidth;
        }
        g.remove();
    }
    private yBreakdown(d, i) {
        var yBreakdownValue = 0;
        var startingPointCumulative = 0
        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerHeight, 0]);

        //calculate the cumulative starting value        
        for (let index = 0; index < i; index++) {
            if (this.barChartData[index].isPillar == 1 || index == 0) {
                startingPointCumulative = this.yValue(this.barChartData[index]);
            } else {
                startingPointCumulative += this.yValue(this.barChartData[index]);
            }
        }

        //if the current breakdown is negative, reduce the value else do nothing. 
        if (this.yValue(d) < 0) {
            startingPointCumulative += Math.abs(this.yValue(d));
        }
        // no adjustment done for the main pillars

        if (d.isPillar == 1 || i == 0) {
        } else {
            yBreakdownValue = yScale(0) - yScale(startingPointCumulative);
        }

        return yBreakdownValue;
    }

    private getYPosition(d, i) {
        var Yposition = 0;
        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerHeight, 0]);

        if ((d.isPillar == 1 || i == 0) && d.value < 0) {
            if (this.maxValue >= 0) {
                Yposition = yScale(0);
            } else {
                Yposition = yScale(this.maxValue);
            }
        } else {
            Yposition = yScale(d.value) - this.yBreakdown(d, i);
        }
        return Yposition;
    }
    private getHeight(d, i) {
        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerHeight, 0]);
        if (d.isPillar == 1 || i == 0) {
            if (d.value > 0) {
                if (this.minValue < 0) {
                    return yScale(0) - yScale(d.value);

                } else {
                    return yScale(0) - yScale(Math.abs(d.value) - this.minValue);

                }

            } else {
                if (this.maxValue >= 0) {
                    return yScale(d.value) - yScale(0);
                } else {
                    return yScale(d.value) - yScale(this.maxValue);
                }
            }
        } else {

            return yScale(0) - yScale(Math.abs(d.value));
        }
    }

    private createLabels(gParent) {

        var g = gParent.append('g').attr('class', 'myBarLabels');

        var yPosition = (d, i) => {
            var yPosition
            var nodeID = i;
            var heightAdjustment = 0;
            pillarLabelsg.each((d, i, nodes) => {
                if (nodeID == i) {
                    
                    heightAdjustment = nodes[i].getBoundingClientRect().height;
                }
            })

            switch (d.customLabelPositioning) {
                case "Inside end":
                    yPosition = this.getYPosition(d, i) + heightAdjustment;
                    break;

                case "Outside end":
                    if (d.value >= 0) {
                        yPosition = this.getYPosition(d, i) - 5;
                    } else {
                        yPosition = this.getYPosition(d, i) + this.getHeight(d, i) + heightAdjustment;
                    }
                    break;
                case "Inside center":
                    yPosition = (this.getYPosition(d, i) + this.getHeight(d, i) / 2) + heightAdjustment / 2;

                    break;
                case "Inside base":
                    yPosition = this.getYPosition(d, i) + this.getHeight(d, i) - heightAdjustment / 2;
                    break;
                case "Outside top":
                    yPosition = this.getYPosition(d, i) - 5;

                    break;
                case "Inside bottom":
                    yPosition = this.getYPosition(d, i) + this.getHeight(d, i) + heightAdjustment;

            }

            return yPosition;
        }
        var xScale = d3.scaleBand()
            .domain(this.barChartData.map(this.xValue))
            .range([0, this.innerWidth])
            .padding(0.2);
        if (this.visualSettings.LabelsFormatting.show) {

            var pillarLabelsg = g.selectAll('.labels')
                .data(this.barChartData)
                .enter().append('g');

            var pillarLabels = pillarLabelsg
                .append('text')
                .attr('class', 'labels');


            var labelFormatting = d => {
                
                return this.formattedValuefromData(d);
            }

            var pillarLabelsText = pillarLabels
                .text(d => labelFormatting(d));

            pillarLabelsText.style('font-size', this.visualSettings.LabelsFormatting.fontSize)
                .style("font-family", this.visualSettings.LabelsFormatting.fontFamily)
                .style('fill', (d) => {
                    return d.customFontColor;
                });

            pillarLabelsg.attr('transform', (d, i) => `translate(${xScale(d.category)},${yPosition(d, i)})`)

        }

        g.selectAll(".labels")
            .call(this.labelFitToWidth);
        this.tooltipServiceWrapper.addTooltip(g.selectAll('.labels'),
            (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipData(tooltipEvent.data),
            (tooltipEvent: TooltipEventArgs<number>) => null);



        g.selectAll(".labels")
            .call(this.labelAlignment, xScale.bandwidth());
        g.attr('transform', `translate(${0},${this.margin.top})`);



    }
    private createBars(gParent, data) {
        var g = gParent.append('g').attr('class', 'myBars');

        var xScale = d3.scaleBand()
            .domain(data.map(this.xValue))
            .range([0, this.innerWidth])
            .padding(0.2);

        this.bars = g.selectAll('rect').data(this.barChartData)
            .enter().append('rect')
            .attr('x', d => xScale(d.category))
            .attr('y', (d, i) => this.getYPosition(d, i))
            .attr('width', xScale.bandwidth())
            .attr('height', (d, i) => this.getHeight(d, i))
            .attr('fill', d => d.customBarColor);

        // Clear selection when clicking outside a bar
        this.svg.on('click', (d) => {
            if (this.host.allowInteractions) {
                this.selectionManager
                    .clear()
                    .then(() => {
                        this.selectionManager.registerOnSelectCallback(
                            (ids: ISelectionId[]) => {
                                this.syncSelectionState(this.bars, ids);
                            });
                    });
            }
            this.bars.attr('fill-opacity', 1);
        });

        //reset selections when the visual is re-drawn 
        this.syncSelectionState(
            this.bars,
            this.selectionManager.getSelectionIds() as ISelectionId[]
        );
        if (this.visualType == "drillable" || this.visualType == "staticCategory" || this.visualType == "drillableCategory") {
            this.bars.on('click', (d) => {
                // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)

                if (this.host.allowInteractions) {
                    const isCtrlPressed: boolean = (d3.event as MouseEvent).ctrlKey;
                    if (this.selectionManager.hasSelection() && !isCtrlPressed) {
                        this.bars.attr('fill-opacity', 1);
                    }
                    this.selectionManager
                        .select(d.selectionId, isCtrlPressed)
                        .then((ids: ISelectionId[]) => {
                            this.syncSelectionState(this.bars, ids);
                        });
                    (<Event>d3.event).stopPropagation();
                }
            });
        }

        this.tooltipServiceWrapper.addTooltip(g.selectAll('rect'),
            (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipData(tooltipEvent.data),
            (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipSelectionID(tooltipEvent.data));

        g.attr('transform', `translate(${0},${this.margin.top})`);



    }
    private syncSelectionState = (bars, selectionIds: ISelectionId[]) => {
        if (!selectionIds.length) {
            bars.attr("fill-opacity", null);
            return;
        }
        bars.each((d, i, nodes) => {
            const isSelected: boolean = this.isSelectionIdInArray(selectionIds, d.selectionId);
            d3.select(nodes[i]).attr('fill-opacity', isSelected
                ? 1
                : 0.5
            );
        });
    }
    private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {

        if (!selectionIds || !selectionId) {
            return false;
        }
        return selectionIds.some((currentSelectionId: ISelectionId) => {
            return currentSelectionId.includes(selectionId);
        });
    };
    private lineWidth(d, i) {
        var defaultwidth = this.defaultXAxisGridlineStrokeWidth() / 10 + "px";
        if (d.displayName == "" || i == 0) {
            defaultwidth = "0" + "px";
        }
        return defaultwidth;

    }
    private getTooltipSelectionID(value: any): ISelectionId {
        return value.selectionId;
    }
    private getTooltipData(value: any): VisualTooltipDataItem[] {

        var tooltip = [];
        if (value.isPillar == 1) {
            tooltip = [{
                displayName: value.toolTipDisplayValue1,
                value: value.toolTipValue1Formatted
            }];
        } else {
            if (value.toolTipDisplayValue2 == null) {
                tooltip = [{
                    displayName: value.toolTipDisplayValue1,
                    value: value.toolTipValue1Formatted
                }];
            } else {
                tooltip = [{
                    displayName: value.toolTipDisplayValue1,
                    value: value.toolTipValue1Formatted,
                }, {
                    displayName: value.toolTipDisplayValue2,
                    value: value.toolTipValue2Formatted
                }];
            }

        }
        return tooltip;
    }
    private getTooltipXaxis(value: any): VisualTooltipDataItem[] {

        var tooltip = [];
        tooltip = [{
            displayName: value.displayName,
        }];

        return tooltip;
    }
    private labelAlignment(tspan, width) {

        tspan.each(function () {
            var tspan = d3.select(this);
            var tspanWidth = tspan.node().getComputedTextLength();
            var diff = (width - tspanWidth) / 2;
            tspan.attr('dx', diff);

        });
    }
    private findXaxisAdjustment = (data): number => {
        var returnvalue = 0;
        if (this.visualSettings.yAxisFormatting.YAxisDataPointOption == "Auto" || this.visualSettings.yAxisFormatting.YAxisDataPointOption == "Range") {

            /************************************************
                this function is used to move the Yaxis to reduce the pillars size so that they don't start from zero, if pillars are all positive or negative
            *************************************************/
            var minDataPoint = 0;
            var maxDataPoint = 0;
            var cumulativeDataPoints = [];
            for (let index = 0; index < data.length; index++) {

                if (data[index].isPillar == 0) {
                    if (index == 0) {
                        cumulativeDataPoints.push(data[index].value)
                    } else {
                        cumulativeDataPoints.push(data[index].value + cumulativeDataPoints[index - 1]);
                    }
                } else {
                    cumulativeDataPoints.push(data[index].value)
                }
            }
            minDataPoint = Math.min(...cumulativeDataPoints);
            maxDataPoint = Math.max(...cumulativeDataPoints);


            if (minDataPoint >= 0 && maxDataPoint >= 0) {
                if (maxDataPoint - minDataPoint < minDataPoint) {
                    returnvalue = maxDataPoint - minDataPoint;
                }
            }

            if (minDataPoint <= 0 && maxDataPoint <= 0) {
                if (minDataPoint - maxDataPoint > maxDataPoint) {
                    returnvalue = Math.abs(minDataPoint - maxDataPoint);
                }
            }
        }
        return returnvalue;
    }
    private findMinCumulativeValue = (data): number => {
        var minDataPoint = 0;
        /*if (this.visualSettings.yAxisFormatting.YAxisDataPointOption == "Range") {
            minDataPoint = this.visualSettings.yAxisFormatting.YAxisDataPointStartRange;
        } else */ {

            var cumulativeDataPoints = [];
            for (let index = 0; index < data.length; index++) {

                if (data[index].isPillar == 0) {
                    if (index == 0) {
                        cumulativeDataPoints.push(data[index].value);
                    } else {
                        cumulativeDataPoints.push(data[index].value + cumulativeDataPoints[index - 1]);
                    }

                } else {
                    cumulativeDataPoints.push(data[index].value)
                }

            }
            minDataPoint = Math.min(...cumulativeDataPoints);

            if (minDataPoint > 0) {
                if (this.adjustmentConstant == 0) {
                    minDataPoint = 0;
                } else {
                    minDataPoint = minDataPoint - this.adjustmentConstant;
                }

            } else {
                minDataPoint = (minDataPoint);
            }
        }
        return minDataPoint;
    }
    private findMaxCumulativeValue = (data): number => {
        var maxDataPoint = 0;
        /*if (this.visualSettings.yAxisFormatting.YAxisDataPointOption == "Range") {
            maxDataPoint = this.visualSettings.yAxisFormatting.YAxisDataPointEndRange;
        } else*/ {
            var cumulativeDataPoints = [];
            for (let index = 0; index < data.length; index++) {
                if (data[index].isPillar == 0) {
                    if (index == 0) {
                        cumulativeDataPoints.push(data[index].value);
                    } else {
                        cumulativeDataPoints.push(data[index].value + cumulativeDataPoints[index - 1]);
                    }
                } else {
                    cumulativeDataPoints.push(data[index].value);
                }
            }
            maxDataPoint = Math.max(...cumulativeDataPoints);
            if (maxDataPoint < 0) {
                if (this.adjustmentConstant == 0) {
                    maxDataPoint = 0;
                } else {
                    maxDataPoint = maxDataPoint + this.adjustmentConstant;
                }
            } else {
                maxDataPoint = maxDataPoint;
            }
        }
        return maxDataPoint;
    }
    private getfillColor(isPillar: number, value: number) {
        var barColor: string = "#777777";
        if (isPillar == 1) {
            barColor = this.visualSettings.sentimentColor.sentimentColorTotal;
        } else {
            if (value < 0) {
                barColor = this.visualSettings.sentimentColor.sentimentColorAdverse;
            } else {
                barColor = this.visualSettings.sentimentColor.sentimentColorFavourable;
            }
        }
        return barColor;

    }
    private getLabelFontColor(isPillar: number, value: number) {
        if (this.visualSettings.LabelsFormatting.useDefaultFontColor) {
            return this.visualSettings.LabelsFormatting.fontColor;
        } else {
            if (isPillar == 1) {
                return this.visualSettings.LabelsFormatting.sentimentFontColorTotal;
            } else if (value < 0) {
                return this.visualSettings.LabelsFormatting.sentimentFontColorAdverse;
            } else {
                return this.visualSettings.LabelsFormatting.sentimentFontColorFavourable;
            }
        }
    }
    private getLabelPosition(isPillar: number, value: number) {
        if (this.visualSettings.LabelsFormatting.useDefaultLabelPositioning) {
            return this.visualSettings.LabelsFormatting.labelPosition;
        } else {
            if (isPillar == 1) {
                return this.visualSettings.LabelsFormatting.labelPositionTotal;
            } else if (value < 0) {
                return this.visualSettings.LabelsFormatting.labelPositionAdverse;
            } else {
                return this.visualSettings.LabelsFormatting.labelPositionFavourable;
            }
        }

    }
    private myFormat_lessThanOne = d3.format(",.2f"); //2 means number of decimal points
    private myFormat_Nodp = d3.format("~s");
    private myFormat_3dp = d3.format(".3s"); //3 means total number of digits in the formatted text
    private myFormatnegative_3dpNegative = d3.format("(.3s"); //3 means total number of digits in the formatted text

    private getDataStaticWaterfall(options: VisualUpdateOptions) {
        let dataView: DataView = options.dataViews[0];

        let iValueFormatter;
        var visualData = [];
        for (let index = 0; index < dataView.matrix.columns.root.children.length; index++) {


            dataView.matrix.rows.root.children.forEach((x: DataViewMatrixNode) => {

                var checkforZero = false;
                if (this.visualSettings.LabelsFormatting.HideZeroBlankValues && +x.values[index].value == 0) {
                    checkforZero = true;
                }
                if (checkforZero == false) {
                    var data2 = [];

                    data2["value"] = +x.values[index].value;

                    data2["numberFormat"] = dataView.matrix.valueSources[index].format;
                    iValueFormatter = valueFormatter.create({ format: data2["numberFormat"] });
                    if (this.visualSettings.LabelsFormatting.valueFormat == "Auto") {
                        if (Math.abs(data2["value"]) < 1) {
                            data2["formattedValue"] = this.myFormat_lessThanOne(data2["value"]);
                        } else {
                            if (this.visualSettings.LabelsFormatting.negativeInBrackets) {
                                data2["formattedValue"] = this.myFormatnegative_3dpNegative(data2["value"]).replace(/G/, "B");
                            } else {
                                data2["formattedValue"] = this.myFormat_3dp(data2["value"]).replace(/G/, "B");
                            }
                        }

                    } else if (this.visualSettings.LabelsFormatting.valueFormat == "Thousands") {
                        data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 100) / 10) + "k";
                    } else if (this.visualSettings.LabelsFormatting.valueFormat == "Millions") {
                        data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 100000) / 10) + "M";
                    } else if (this.visualSettings.LabelsFormatting.valueFormat == "Billions") {
                        data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 10000000) / 10) + "B";
                    } else {
                        data2["formattedValue"] = iValueFormatter.format(data2["value"]);
                    }

                    data2["originalFormattedValue"] = iValueFormatter.format(data2["value"]);
                    data2["selectionId"] = this.host.createSelectionIdBuilder()
                        .withMeasure(dataView.matrix.valueSources[index].queryName)
                        .createSelectionId();



                    if (dataView.matrix.valueSources[index].objects) {
                        if (dataView.matrix.valueSources[index].objects.definePillars) {
                            data2["category"] = dataView.matrix.valueSources[index].displayName;
                            data2["displayName"] = dataView.matrix.valueSources[index].displayName;
                            if (dataView.matrix.valueSources[index].objects["definePillars"]["pillars"]) {
                                data2["isPillar"] = 1;
                            } else {
                                data2["isPillar"] = 0;
                            }
                        } else {

                            if (dataView.matrix.valueSources[index].displayName.substring(0, 1) != "_") {
                                data2["isPillar"] = 0;
                                data2["category"] = dataView.matrix.valueSources[index].displayName;
                                data2["displayName"] = dataView.matrix.valueSources[index].displayName;
                            } else {
                                data2["isPillar"] = 1;
                                data2["category"] = dataView.matrix.valueSources[index].displayName.substring(1);
                                data2["displayName"] = dataView.matrix.valueSources[index].displayName.substring(1);
                            }
                        }
                    } else {

                        if (dataView.matrix.valueSources[index].displayName.substring(0, 1) != "_") {
                            data2["isPillar"] = 0;
                            data2["category"] = dataView.matrix.valueSources[index].displayName;
                            data2["displayName"] = dataView.matrix.valueSources[index].displayName;
                        } else {
                            data2["isPillar"] = 1;
                            data2["category"] = dataView.matrix.valueSources[index].displayName.substring(1);
                            data2["displayName"] = dataView.matrix.valueSources[index].displayName.substring(1);
                        }
                    }

                    if (dataView.matrix.valueSources[index].objects) {
                        if (dataView.matrix.valueSources[index].objects.sentimentColor && !this.visualSettings.chartOrientation.useSentimentFeatures) {
                            data2["customBarColor"] = dataView.matrix.valueSources[index].objects["sentimentColor"]["fill1"]["solid"]["color"];
                        } else {
                            data2["customBarColor"] = this.getfillColor(data2["isPillar"], data2["value"]);
                        }
                        if (dataView.matrix.valueSources[index].objects.LabelsFormatting && !this.visualSettings.chartOrientation.useSentimentFeatures && !this.visualSettings.LabelsFormatting.useDefaultFontColor) {
                            if (dataView.matrix.valueSources[index].objects.LabelsFormatting.fill1) {
                                data2["customFontColor"] = dataView.matrix.valueSources[index].objects["LabelsFormatting"]["fill1"]["solid"]["color"];
                            } else {
                                data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
                            }
                        } else {
                            data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
                        }

                        if (dataView.matrix.valueSources[index].objects.LabelsFormatting && !this.visualSettings.chartOrientation.useSentimentFeatures && !this.visualSettings.LabelsFormatting.useDefaultLabelPositioning) {
                            if (dataView.matrix.valueSources[index].objects.LabelsFormatting.labelPosition) {
                                data2["customLabelPositioning"] = dataView.matrix.valueSources[index].objects["LabelsFormatting"]["labelPosition"];
                            } else {
                                data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
                            }
                        } else {
                            data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
                        }
                    } else {
                        data2["customBarColor"] = this.getfillColor(data2["isPillar"], data2["value"]);
                        data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
                        data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
                    }

                    data2["toolTipValue1Formatted"] = data2["formattedValue"];
                    data2["toolTipDisplayValue1"] = data2["category"];
                    data2["childrenCount"] = 1;
                    visualData.push(data2);
                }
            });
        }
        return visualData;

    }
    private formattedValuefromData(d: any) {
        var iValueFormatter = valueFormatter.create({ format: d.numberFormat });
        var formattedvalue;
        switch (this.visualSettings.LabelsFormatting.valueFormat) {
            case "Auto": {

                if (Math.abs(this.minValue) >= 1000000000 || Math.abs(this.maxValue) >= 1000000000) {
                    formattedvalue = iValueFormatter.format(Math.round(d.value / 10000000) / 10) + "B";
                } else if (Math.abs(this.minValue) >= 1000000 || Math.abs(this.maxValue) >= 1000000) {
                    formattedvalue = iValueFormatter.format(Math.round(d.value / 100000) / 10) + "M";
                } else if (Math.abs(this.minValue) >= 1000 || Math.abs(this.maxValue) >= 1000) {
                    formattedvalue = iValueFormatter.format(Math.round(d.value / 100) / 10) + "k";
                } else {
                    formattedvalue = this.myFormat_lessThanOne(d.value);
                }


                break;
            }
            case "Thousands": {
                formattedvalue = iValueFormatter.format(Math.round(d.value / 100) / 10) + "k";
                break;
            }
            case "Millions": {
                formattedvalue = iValueFormatter.format(Math.round(d.value / 100000) / 10) + "M";
                break;
            }
            case "Billions": {
                formattedvalue = iValueFormatter.format(Math.round(d.value / 10000000) / 10) + "B";
                break;
            }
            default: {
                formattedvalue = iValueFormatter.format(d.value);
                break;
            }
        }        
        return formattedvalue;
    }
    private getDataDrillableWaterfall(options: VisualUpdateOptions) {
        let dataView: DataView = options.dataViews[0];
        var totalData = [];
        var visualData = [];
        var allMeasureValues = [];

        // find all values and aggregate them in an array of array with each child in an array of a measure
        
        allMeasureValues = this.findLowestLevels();

        var sortOrderPrecision = Math.pow(10, allMeasureValues.length * allMeasureValues[0].length.toString().length);

        // calculate the difference between each measure and add them to an array as the step bars and then add the pillar bars [visualData]
        for (let indexMeasures = 0; indexMeasures < allMeasureValues.length; indexMeasures++) {
            var totalValueofMeasure = 0;
            var toolTipDisplayValue1 = "";
            var toolTipDisplayValue2 = "";
            var Measure1Value: number = null;
            var Measure2Value: number = null;
            var dataPillar = [];
            for (let nodeItems = 0; nodeItems < allMeasureValues[indexMeasures].length; nodeItems++) {
                totalValueofMeasure = totalValueofMeasure + allMeasureValues[indexMeasures][nodeItems].value
                if (indexMeasures < allMeasureValues.length - 1) {
                    var data2Category = [];
                    Measure1Value = +allMeasureValues[indexMeasures][nodeItems].value;
                    Measure2Value = +allMeasureValues[indexMeasures + 1][nodeItems].value;
                    var valueDifference = Measure2Value - Measure1Value;
                    var HideZeroBlankValues: boolean = this.visualSettings.LabelsFormatting.HideZeroBlankValues;
                    if (HideZeroBlankValues && valueDifference == 0) {

                    } else {
                        toolTipDisplayValue1 = dataView.matrix.valueSources[indexMeasures].displayName + allMeasureValues[indexMeasures][nodeItems].category.toString();
                        toolTipDisplayValue2 = dataView.matrix.valueSources[indexMeasures + 1].displayName + allMeasureValues[indexMeasures + 1][nodeItems].category.toString();

                        var displayName: string = allMeasureValues[indexMeasures][nodeItems].displayName;
                        var category: string = dataView.matrix.valueSources[indexMeasures].displayName + allMeasureValues[indexMeasures][nodeItems].category.toString();
                        var selectionId = allMeasureValues[indexMeasures][nodeItems].selectionId;
                        data2Category = this.getDataForCategory(valueDifference, dataView.matrix.valueSources[indexMeasures].format, displayName, category, 0, selectionId, indexMeasures + 1 + ((nodeItems + 1) / sortOrderPrecision), 1, toolTipDisplayValue1, toolTipDisplayValue2, Measure1Value, Measure2Value);
                        visualData.push(data2Category);
                    }
                }
            }
            toolTipDisplayValue1 = dataView.matrix.valueSources[indexMeasures].displayName;
            toolTipDisplayValue2 = null;
            Measure1Value = totalValueofMeasure;
            Measure2Value = null;
            dataPillar = this.getDataForCategory(totalValueofMeasure, dataView.matrix.valueSources[indexMeasures].format, dataView.matrix.valueSources[indexMeasures].displayName, dataView.matrix.valueSources[indexMeasures].displayName, 1, null, indexMeasures + 1, 1, toolTipDisplayValue1, toolTipDisplayValue2, Measure1Value, Measure2Value);
            visualData.push(dataPillar);
        }
        // Sort the [visualData] in order of the display
        visualData.sort(function (a, b) {
            return a.sortOrder - b.sortOrder;
        });

        // add arrays to the main array for additional x-axis for each category
        for (let levelItems = 0; levelItems < dataView.matrix.rows.levels.length - 1; levelItems++) {
            var categorynode = []
            var childrenCount = 1;
            var displayNode;

            for (let nodeItems = 0; nodeItems < visualData.length; nodeItems++) {
                var currNode = visualData[nodeItems];
                var childnode = [];
                var currCategoryText: string = currNode["category"];
                var currCategoryArray: string[] = currCategoryText.split("|");
                var newDisplayName = currCategoryArray[levelItems + 1];

                if (currNode["isPillar"] == 1 || nodeItems == 0) {

                } else {
                    var previousNode = visualData[nodeItems - 1];
                    var previousCategoryText: string = previousNode["category"];
                    var previousCategoryArray: string[] = previousCategoryText.split("|");
                    if (newDisplayName == previousCategoryArray[levelItems + 1]) {
                        newDisplayName = "";
                    }
                }

                childnode = this.getDataForCategory(currNode["value"], currNode["numberFormat"], newDisplayName, currCategoryText, currNode["isPillar"], null, currNode["sortOrder"], childrenCount, currNode["toolTipDisplayValue1"], currNode["toolTipDisplayValue2"], currNode["Measure1Value"], currNode["Measure2Value"]);
                if (displayNode != undefined) {
                    if (displayNode.displayName == currCategoryArray[levelItems + 1]) {
                        displayNode.childrenCount = displayNode.childrenCount + 1;
                    } else {
                        displayNode = childnode;
                    }
                } else {
                    displayNode = childnode;
                }

                categorynode.push(childnode);
            }
            totalData.push(categorynode);
        }

        // final array that contains all the values as the last array, while all the other array are only for additional x-axis
        totalData.push(visualData);
        return totalData;

    }
    private getDataStaticCategoryWaterfall(options: VisualUpdateOptions) {
        let dataView: DataView = options.dataViews[0];
        let iValueFormatter;
        var visualData = [];
        var hasPillar = false;
        //*******************************************************************
        //This will always be zero as it should only have 1 measure
        var measureIndex = 0;
        //*******************************************************************

        dataView.matrix.rows.root.children.forEach((x: DataViewMatrixNode) => {
            var checkforZero = false;
            if (this.visualSettings.LabelsFormatting.HideZeroBlankValues && +x.values[measureIndex].value == 0) {
                checkforZero = true;
            }
            if (checkforZero == false) {
                var data2 = [];

                data2["value"] = +x.values[measureIndex].value;

                data2["numberFormat"] = dataView.matrix.valueSources[measureIndex].format;
                iValueFormatter = valueFormatter.create({ format: data2["numberFormat"] });
                if (this.visualSettings.LabelsFormatting.valueFormat == "Auto") {
                    if (Math.abs(data2["value"]) < 1) {
                        data2["formattedValue"] = this.myFormat_lessThanOne(data2["value"]);
                    } else {
                        if (this.visualSettings.LabelsFormatting.negativeInBrackets) {
                            data2["formattedValue"] = this.myFormatnegative_3dpNegative(data2["value"]).replace(/G/, "B");
                        } else {
                            data2["formattedValue"] = this.myFormat_3dp(data2["value"]).replace(/G/, "B");
                        }
                    }

                } else if (this.visualSettings.LabelsFormatting.valueFormat == "Thousands") {
                    data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 100) / 10) + "k";
                } else if (this.visualSettings.LabelsFormatting.valueFormat == "Millions") {
                    data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 100000) / 10) + "M";
                } else if (this.visualSettings.LabelsFormatting.valueFormat == "Billions") {
                    data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 10000000) / 10) + "B";
                } else {
                    data2["formattedValue"] = iValueFormatter.format(data2["value"]);
                }

                data2["originalFormattedValue"] = iValueFormatter.format(data2["value"]);

                data2["selectionId"] = this.host.createSelectionIdBuilder()
                    .withMatrixNode(x, dataView.matrix.rows.levels)
                    .createSelectionId();
                if (x.value == null) {
                    data2["category"] = "(blank)";
                    data2["displayName"] = "(blank)";

                } else {
                    data2["category"] = x.value;
                    data2["displayName"] = x.value;
                };
                if (x.objects) {
                    if (x.objects.definePillars) {
                        if (x.objects["definePillars"]["pillars"]) {
                            data2["isPillar"] = 1;
                            hasPillar = true;
                        } else {
                            data2["isPillar"] = 0;
                        }
                    } else {
                        data2["category"] = x.value;
                        data2["displayName"] = x.value;
                        data2["isPillar"] = 0;
                    }
                } else {
                    data2["isPillar"] = 0;
                }

                if (x.objects) {
                    if (x.objects.sentimentColor && !this.visualSettings.chartOrientation.useSentimentFeatures) {
                        data2["customBarColor"] = x.objects["sentimentColor"]["fill1"]["solid"]["color"];
                    } else {
                        data2["customBarColor"] = this.getfillColor(data2["isPillar"], data2["value"]);
                    }
                    if (x.objects.LabelsFormatting && !this.visualSettings.LabelsFormatting.useDefaultFontColor) {
                        if (x.objects.LabelsFormatting.fill1) {
                            data2["customFontColor"] = x.objects["LabelsFormatting"]["fill1"]["solid"]["color"];
                        } else {
                            data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
                        }

                    } else {
                        data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
                    }

                    if (x.objects.LabelsFormatting && !this.visualSettings.chartOrientation.useSentimentFeatures && !this.visualSettings.LabelsFormatting.useDefaultLabelPositioning) {
                        if (x.objects.LabelsFormatting.labelPosition) {
                            data2["customLabelPositioning"] = x.objects["LabelsFormatting"]["labelPosition"];
                        } else {
                            data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
                        }
                    } else {
                        data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
                    }
                } else {
                    data2["customBarColor"] = this.getfillColor(data2["isPillar"], data2["value"]);
                    data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
                    data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
                }

                data2["toolTipValue1Formatted"] = data2["formattedValue"];
                data2["toolTipDisplayValue1"] = data2["category"];
                data2["childrenCount"] = 1;
                visualData.push(data2);
            }
        });
        if (!hasPillar) {
            visualData.push(this.addTotalLine(visualData, options));
        }
        return visualData;

    }
    private getDataDrillableCategoryWaterfall(options: VisualUpdateOptions) {

        let dataView: DataView = options.dataViews[0];
        var totalData = [];
        var visualData = [];
        var allMeasureValues = [];

        // find all values and aggregate them in an array of array with each child in an array of a measure        
        allMeasureValues = this.findLowestLevels();
        var sortOrderPrecision = Math.pow(10, allMeasureValues.length * allMeasureValues[0].length.toString().length);

        // calculate the difference between each measure and add them to an array as the step bars and then add the pillar bars [visualData]
        let indexMeasures = 0;

        var totalValueofMeasure = 0;
        var toolTipDisplayValue1 = "";        
        var Measure1Value: number = null;                
        for (let nodeItems = 0; nodeItems < allMeasureValues[indexMeasures].length; nodeItems++) {
            totalValueofMeasure = totalValueofMeasure + allMeasureValues[indexMeasures][nodeItems].value

            var data2Category = [];
            Measure1Value = +allMeasureValues[indexMeasures][nodeItems].value;
            
            var valueDifference = Measure1Value;
            var HideZeroBlankValues: boolean = this.visualSettings.LabelsFormatting.HideZeroBlankValues;
            if (HideZeroBlankValues && valueDifference == 0) {

            } else {

                toolTipDisplayValue1 = dataView.matrix.valueSources[indexMeasures].displayName + allMeasureValues[indexMeasures][nodeItems].category.toString();                
                var displayName: string = allMeasureValues[indexMeasures][nodeItems].displayName;
                var category: string = dataView.matrix.valueSources[indexMeasures].displayName + allMeasureValues[indexMeasures][nodeItems].category.toString();
                var selectionId = allMeasureValues[indexMeasures][nodeItems].selectionId;
                data2Category = this.getDataForCategory(valueDifference, dataView.matrix.valueSources[indexMeasures].format, displayName, category, 0, selectionId, 1, 1, toolTipDisplayValue1, null, Measure1Value, null);
                visualData.push(data2Category);
            }

        }
        visualData.push(this.addTotalLine(visualData, options));


        // add arrays to the main array for additional x-axis for each category
        for (let levelItems = 0; levelItems < dataView.matrix.rows.levels.length - 1; levelItems++) {
            var categorynode = []
            var childrenCount = 1;
            var displayNode;

            for (let nodeItems = 0; nodeItems < visualData.length; nodeItems++) {
                var currNode = visualData[nodeItems];
                var childnode = [];
                var currCategoryText: string = currNode["category"];
                var currCategoryArray: string[] = currCategoryText.split("|");
                var newDisplayName = currCategoryArray[levelItems + 1];

                if (currNode["isPillar"] == 1 || nodeItems == 0) {

                } else {
                    var previousNode = visualData[nodeItems - 1];
                    var previousCategoryText: string = previousNode["category"];
                    var previousCategoryArray: string[] = previousCategoryText.split("|");
                    if (newDisplayName == previousCategoryArray[levelItems + 1]) {
                        newDisplayName = "";
                    }
                }

                childnode = this.getDataForCategory(currNode["value"], currNode["numberFormat"], newDisplayName, currCategoryText, currNode["isPillar"], null, currNode["sortOrder"], childrenCount, currNode["toolTipDisplayValue1"], currNode["toolTipDisplayValue2"], currNode["Measure1Value"], currNode["Measure2Value"]);
                if (displayNode != undefined) {
                    if (displayNode.displayName == currCategoryArray[levelItems + 1]) {
                        displayNode.childrenCount = displayNode.childrenCount + 1;
                    } else {
                        displayNode = childnode;
                    }
                } else {
                    displayNode = childnode;
                }

                categorynode.push(childnode);
            }
            totalData.push(categorynode);
        }

        // final array that contains all the values as the last array, while all the other array are only for additional x-axis
        totalData.push(visualData);
        return totalData;

    }
    private findLowestLevels() {

        function getChildLevel(currentNode, parentText: string, indexMeasures) {
            if (currentNode.children.length != undefined) {
                currentNode.children.forEach(child => {
                    if (child.children != undefined) {
                        childrenCount = childrenCount + 1
                        getChildLevel(child, parentText + "|" + child.value, indexMeasures);
                    } else {

                        var node = [];
                        node["value"] = child.values[indexMeasures].value;
                        node["category"] = (parentText + "|" + child.value).replace("null", "(blank)");
                        if (child.value == null) {
                            node["displayName"] = "(blank)";
                        } else {
                            node["displayName"] = child.value;
                        }
                        /* var selectionId: ISelectionId = host1.createSelectionIdBuilder()
                            .withMatrixNode(child, rows.levels)
                            .createSelectionId(); */
                        var selectionId: ISelectionId = host1.createSelectionIdBuilder()
                            .withMatrixNode(child, rows.levels)
                            .createSelectionId();
                        node["selectionId"] = selectionId;
                        nodes.push(node);

                    };
                });
            }
        };
        var dataView = this.visualUpdateOptions.dataViews[0];
        var rows = dataView.matrix.rows;
        var root = rows.root;
        var allNodes = [];
        var childrenCount = 0;
        var host1 = this.host
        for (let indexMeasures = 0; indexMeasures < dataView.matrix.valueSources.length; indexMeasures++) {
            var nodes = [];
            getChildLevel(root, "", indexMeasures);
            allNodes.push(nodes);
        }
        return allNodes;

    }
    private getAllMatrixLevelsNew(root, num) {

        function getChildLevel(currentNode, parentText: string) {
            if (currentNode.children.length != undefined) {
                
                currentNode.children.forEach(child => {
                    if (index == num) {
                        mainNode.push(createNode(child));
                    } else {
                        
                        index = index + 1;
                        if (child.children != undefined) {
                            
                            getChildLevel(child, parentText + "|" + child.value);
                        };
                        index = index - 1;
                    }
                    
                });

            }

        };
        function createNode(child) {
            var node = [];
            if (child.children == undefined) {
                for (let indexMeasures = 0; indexMeasures < dataView.matrix.valueSources.length; indexMeasures++) {
                    var nodeValue = [];
                    nodeValue = child.values[indexMeasures].value;
                    node.push(nodeValue);
                }
            } else {
                counter = 0;
                countChildrens(child);
                node["childrenCount"] = counter;
                
            }
            if (child.value == null) {
                node["category"] = "(blank)";
                node["displayName"] = "(blank)";
            } else {
                node["category"] = child.value;
                node["displayName"] = child.value;
            }

            var selectionId: ISelectionId = host1.createSelectionIdBuilder()
                .withMatrixNode(child, rows.levels)
                .createSelectionId();
            node["selectionId"] = selectionId;
            return node;
        }
        function countChildrens(child) {
            if (child.children == undefined) {
                counter = counter + 1;
            } else {
                child.children.forEach(element => {
                    countChildrens(element)
                });
            }

        }
        var counter;
        var index = 0;
        var allNodes = [];
        var childrenCount = 0;
        var host1 = this.host
        var nodes = [];
        var mainNode = [];
        var dataView = this.visualUpdateOptions.dataViews[0];
        var rows = dataView.matrix.rows;
        getChildLevel(root, "");
        allNodes.push(nodes);
        return mainNode;

    }
    private createXaxis(gParent, options, allDatatemp) {
        var g = gParent.append('g').attr('class', 'xAxisParentGroup');

        var myAxisParentHeight = 0; 
        var dataView = this.visualUpdateOptions.dataViews[0];
        var rows = dataView.matrix.rows;
        var root = rows.root;
        var levels = allDatatemp.length;
        var xScale;
        var xBaseScale = d3.scaleBand()
            .domain(allDatatemp[allDatatemp.length - 1].map(this.xValue))
            .range([0, this.innerWidth])
            .padding(0.2);

        if (dataView.matrix.valueSources.length > 1) {
            var pillarsCount = 3;
            var fullWidth = this.innerWidth - xBaseScale.bandwidth() + (xBaseScale.step() * xBaseScale.padding() * pillarsCount);
            var myBandwidth = fullWidth / allDatatemp[allDatatemp.length - 1].length;
        } else {
            var pillarsCount = 2;
            var fullWidth = this.innerWidth - xBaseScale.bandwidth() - (xBaseScale.step() * xBaseScale.padding() * pillarsCount);
            var myBandwidth = fullWidth / (allDatatemp[allDatatemp.length - 1].length - 1);
        }

        for (var allDataIndex = levels - 1; allDataIndex >= 0; allDataIndex--) {
            var currData = [];

            if (allDataIndex == (levels - 1)) {
                xScale = xBaseScale;
                currData = allDatatemp[allDatatemp.length - 1];

            } else {

                currData = this.getAllMatrixLevelsNew(root, allDataIndex);
                var xAxisrange = [];
                var currChildCount = 0
                xAxisrange.push(0);
                currData.forEach(element => {
                    currChildCount = currChildCount + myBandwidth * element.childrenCount;
                    xAxisrange.push(currChildCount);
                });
                xScale = d3.scaleOrdinal()
                    .domain(currData.map((displayName, index) => index + displayName))
                    .range(xAxisrange);
            }
            this.findBottom = 0;
            var myWidth = currChildCount + myBandwidth;
            if (allDataIndex != (levels - 1)) {
                if (dataView.matrix.valueSources.length == 1) {
                    var myxAxisParent;

                    this.createAxis(myxAxisParent, g, false, myWidth, 0, xScale, xBaseScale, currData, allDataIndex, levels, xAxisrange, myAxisParentHeight);
                } else {
                    for (let index = 1; index < dataView.matrix.valueSources.length; index++) {
                        var myxAxisParent;
                        this.createAxis(myxAxisParent, g, false, myWidth, index, xScale, xBaseScale, currData, allDataIndex, levels, xAxisrange, myAxisParentHeight);
                    }
                }

            } else {
                var myxAxisParent;
                this.createAxis(myxAxisParent, g, true, myWidth, 1, xScale, xBaseScale, currData, allDataIndex, levels, xAxisrange, myAxisParentHeight);
            }
            myAxisParentHeight = this.findBottom;
        }

        g.selectAll('text').each((d, i, nodes) => {

            if (this.xAxisPosition <= nodes[i].getBoundingClientRect().bottom) {
                this.xAxisPosition = nodes[i].getBoundingClientRect().bottom;
            };
        });
        
        g.attr('transform', `translate(${0},${this.height - this.xAxisPosition - this.margin.bottom - this.scrollbarBreath})`);

        this.innerHeight = this.height - this.margin.top - this.margin.bottom - this.xAxisPosition - this.scrollbarBreath;
    }
    private findBottom;

    private createAxis(myxAxisParent, g, baseAxis: boolean, myWidth, index: number, xScale, xBaseScale, currData, allDataIndex, levels, xAxisrange, myAxisParentHeight) {
        var myxAxisParentx = d3.axisBottom(xScale).tickSize(0);
        myxAxisParentx.tickSizeOuter(0);
        myxAxisParent = g.append('g')
            .style("font", this.visualSettings.xAxisFormatting.fontSize + "px times")
            .style("font-family", this.visualSettings.xAxisFormatting.fontFamily)
            .style("color", this.visualSettings.xAxisFormatting.fontColor)
            .attr('class', 'myXaxis')
            .call(myxAxisParentx);
        if (baseAxis) {
            myxAxisParent
                .attr('transform', `translate(0,${myAxisParentHeight})`)
                .selectAll('path').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor);
        } else if (index == 0) {
            myxAxisParent
                .attr('transform', `translate(${((xBaseScale.step() * xBaseScale.padding() * 0.5))},${myAxisParentHeight})`)
                .selectAll('path').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor);
        } else {
            myxAxisParent
                .attr('transform', `translate(${(xBaseScale.bandwidth() + (xBaseScale.step() * xBaseScale.padding() * 1.5)) + myWidth * (index - 1)},${myAxisParentHeight})`)
                .selectAll('path').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor);
        }
        var xAxislabels = myxAxisParent.selectAll(".tick text").data(currData).text(d => d.displayName);
        
            
        
        if (this.visualType == "drillable" || this.visualType == "staticCategory" || this.visualType == "drillableCategory") {
            xAxislabels.on('click', (d) => {
                // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)                
                if (this.host.allowInteractions) {
                    const isCtrlPressed: boolean = (d3.event as MouseEvent).ctrlKey;
                    if (this.selectionManager.hasSelection() && !isCtrlPressed) {
                        this.bars.attr('fill-opacity', 1);
                    }
                    this.selectionManager
                        .select(d.selectionId, isCtrlPressed)
                        .then((ids: ISelectionId[]) => {
                            this.syncSelectionState(this.bars, ids);
                        });
                    (<Event>d3.event).stopPropagation();
                }
            });
        }
        //tooltip for x-axis labels
        this.tooltipServiceWrapper.addTooltip(
            myxAxisParent.selectAll(".tick text"),
            (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipXaxis(tooltipEvent.data),
            (tooltipEvent: TooltipEventArgs<number>) => null
        );


        //move the labels of all secondary axis to the right as they don't have pillars

        if (allDataIndex != (levels - 1)) {
            if (this.visualSettings.xAxisFormatting.labelWrapText) {
                myxAxisParent.selectAll(".tick text")
                    .call(this.Label_wraptext, xBaseScale.bandwidth());
            } else {
                myxAxisParent.selectAll(".tick text")
                    .call(this.Label_nowraptext, xBaseScale.bandwidth());
            }



            myxAxisParent.selectAll(".tick text").data(currData)
                .attr('transform', (d, i) => `translate(${
                    (xAxisrange[i + 1] - xAxisrange[i]) / 2
                    },${this.visualSettings.xAxisFormatting.padding})`);

            myxAxisParent.selectAll("line").remove();
        } else {
            if (this.visualSettings.xAxisFormatting.labelWrapText) {
                myxAxisParent.selectAll(".tick text")
                    .call(this.Label_wraptext, xBaseScale.bandwidth());
            } else {
                myxAxisParent.selectAll(".tick text")
                    .call(this.Label_nowraptext, xBaseScale.bandwidth());
            }
            xAxislabels.attr('transform', `translate(0,${this.visualSettings.xAxisFormatting.padding})`);
        }

        myxAxisParent.selectAll("text").each((d, i, nodes) => {
            if (this.findBottom <= nodes[i].getBoundingClientRect().bottom) {
                this.findBottom = nodes[i].getBoundingClientRect().bottom;
            };
        });
        
        if (this.visualSettings.xAxisFormatting.showGridLine) {

            myxAxisParent.selectAll('path')
                .style('fill', 'none')
                .style('stroke', this.visualSettings.xAxisFormatting.gridLineColor)
                .style('stroke-width', this.defaultXAxisGridlineStrokeWidth() / 10 + "px");
            var myAxisTop = myxAxisParent.select("path").node().getBoundingClientRect().top
            myxAxisParent.selectAll(".text").data(currData)
                .enter()
                .append("line")
                .attr("x1", (d, i) => {
                    var x1;
                    if (allDataIndex == (levels - 1)) {
                        x1 = xScale(d.category) - (xScale.padding() * xScale.step()) / 2;
                    } else {
                        
                        x1 = xAxisrange[i];
                    }
                    return x1;
                })
                .attr("y1", 0)
                .attr("x2", (d, i) => {
                    var x1;
                    if (allDataIndex == (levels - 1)) {
                        x1 = xScale(d.category) - (xScale.padding() * xScale.step()) / 2;
                    } else {
                        x1 = xAxisrange[i];;
                    }
                    return x1;
                })
                .attr("y2", this.findBottom - myAxisTop)
                .attr("stroke-width", (d, i) => this.lineWidth(d, i))
                .attr("stroke", this.visualSettings.xAxisFormatting.gridLineColor);
        } else {
            myxAxisParent.selectAll('path')
                .style('fill', 'none')
                .style('stroke', this.visualSettings.xAxisFormatting.gridLineColor)
                .style('stroke-width', "0px");
        }
    }
    private addTotalLine(data: any, options: VisualUpdateOptions) {
        let dataView: DataView = options.dataViews[0];
        var data2 = [];
        var totalValue = 0;
        let iValueFormatter;
        var d3formatnegative = d3.format("(.3s");
        //*******************************************************************
        //This will always be zero as it should only have 1 measure
        var measureIndex = 0;
        //*******************************************************************
        data.forEach(element => {
            totalValue = totalValue + element["value"];
        });
        data2["value"] = totalValue;
        data2["numberFormat"] = data[0]["numberFormat"];
        iValueFormatter = valueFormatter.create({ format: data2["numberFormat"] });
        if (this.visualSettings.LabelsFormatting.valueFormat == "Auto") {
            if (Math.abs(data2["value"]) < 1) {
                data2["formattedValue"] = this.myFormat_lessThanOne(data2["value"]);
            } else {
                if (this.visualSettings.LabelsFormatting.negativeInBrackets) {
                    data2["formattedValue"] = this.myFormatnegative_3dpNegative(data2["value"]).replace(/G/, "B");
                } else {
                    data2["formattedValue"] = this.myFormat_3dp(data2["value"]).replace(/G/, "B");
                }
            }

        } else if (this.visualSettings.LabelsFormatting.valueFormat == "Thousands") {
            data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 100) / 10) + "k";
        } else if (this.visualSettings.LabelsFormatting.valueFormat == "Millions") {
            data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 100000) / 10) + "M";
        } else if (this.visualSettings.LabelsFormatting.valueFormat == "Billions") {
            data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 10000000) / 10) + "B";
        } else {
            data2["formattedValue"] = iValueFormatter.format(data2["value"]);
        }
        data2["originalFormattedValue"] = iValueFormatter.format(data2["value"]);
        data2["isPillar"] = 1;
        data2["category"] = dataView.matrix.valueSources[0].displayName;
        data2["displayName"] = dataView.matrix.valueSources[0].displayName;

        var x = dataView.matrix.valueSources[measureIndex];
        data2["selectionId"] = this.host.createSelectionIdBuilder()
            .withMeasure(x.queryName)
            .createSelectionId();
        if (x.objects) {
            if (x.objects.sentimentColor && !this.visualSettings.chartOrientation.useSentimentFeatures) {
                data2["customBarColor"] = x.objects["sentimentColor"]["fill1"]["solid"]["color"];
            } else {
                data2["customBarColor"] = this.getfillColor(data2["isPillar"], data2["value"]);
            }

            if (x.objects.LabelsFormatting && !this.visualSettings.chartOrientation.useSentimentFeatures && !this.visualSettings.LabelsFormatting.useDefaultFontColor) {
                if (x.objects.LabelsFormatting.fill1) {
                    data2["customFontColor"] = x.objects["LabelsFormatting"]["fill1"]["solid"]["color"];
                } else {
                    data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
                }

            } else {
                data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
            }

            if (x.objects.LabelsFormatting && !this.visualSettings.LabelsFormatting.useDefaultLabelPositioning) {
                if (x.objects.LabelsFormatting.labelPosition) {
                    data2["customLabelPositioning"] = x.objects["LabelsFormatting"]["labelPosition"];
                } else {
                    data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
                }
            } else {
                data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
            }
        } else {
            data2["customBarColor"] = this.getfillColor(data2["isPillar"], data2["value"]);
            data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
            data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
        }

        data2["toolTipValue1Formatted"] = data2["formattedValue"];
        data2["toolTipDisplayValue1"] = data2["category"];
        data2["childrenCount"] = 1;
        return data2;
    }
    private getDataForCategory(value: number, numberFormat: string, displayName: any, displayID: any, isPillar: number, selectionId: any, sortOrder: number, childrenCount: number, toolTipDisplayValue1: string, toolTipDisplayValue2: string, Measure1Value: number, Measure2Value: number) {

        let iValueFormatter;
        var data2 = [];
        data2["value"] = value;
        data2["numberFormat"] = numberFormat;
        iValueFormatter = valueFormatter.create({ format: data2["numberFormat"] });
        if (this.visualSettings.LabelsFormatting.valueFormat == "Auto") {
            if (Math.abs(data2["value"]) < 1) {
                data2["formattedValue"] = this.myFormat_lessThanOne(data2["value"]);
            } else {
                if (this.visualSettings.LabelsFormatting.negativeInBrackets) {
                    data2["formattedValue"] = this.myFormatnegative_3dpNegative(data2["value"]).replace(/G/, "B");
                } else {
                    data2["formattedValue"] = this.myFormat_3dp(data2["value"]).replace(/G/, "B");
                }
            }

        } else if (this.visualSettings.LabelsFormatting.valueFormat == "Thousands") {
            data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 100) / 10) + "k";
        } else if (this.visualSettings.LabelsFormatting.valueFormat == "Millions") {
            data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 100000) / 10) + "M";
        } else if (this.visualSettings.LabelsFormatting.valueFormat == "Billions") {
            data2["formattedValue"] = iValueFormatter.format(Math.round(data2["value"] / 10000000) / 10) + "B";
        } else {
            data2["formattedValue"] = iValueFormatter.format(data2["value"]);
        }
        data2["originalFormattedValue"] = iValueFormatter.format(data2["value"]);
        data2["isPillar"] = isPillar;
        data2["category"] = displayID;
        data2["displayName"] = displayName;
        data2["selectionId"] = selectionId;
        data2["sortOrder"] = sortOrder;
        data2["childrenCount"] = childrenCount;
        data2["Measure1Value"] = Measure1Value;
        data2["Measure2Value"] = Measure2Value;
        data2["toolTipValue1Formatted"] = iValueFormatter.format(Measure1Value);
        data2["toolTipValue2Formatted"] = iValueFormatter.format(Measure2Value);
        data2["toolTipDisplayValue1"] = toolTipDisplayValue1;
        data2["toolTipDisplayValue2"] = toolTipDisplayValue2;
        data2["customBarColor"] = this.getfillColor(data2["isPillar"], data2["value"]);
        data2["customFontColor"] = this.getLabelFontColor(data2["isPillar"], data2["value"]);
        data2["customLabelPositioning"] = this.getLabelPosition(data2["isPillar"], data2["value"]);
        return data2;
    }

    private Label_nowraptext(text, standardwidth) {

        var width;
        text.each(function () {
            var text = d3.select(this),
                
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1,
                y = text.attr("y"),
                dy = parseFloat(text.attr("dy")),
                joinwith = "";



            width = standardwidth * text.datum()["childrenCount"];
            joinwith = "";
            var words = text.text().split("").reverse();


            var tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(joinwith));
                if (tspan.node().getComputedTextLength() > width) {

                    // if the 3 lines goes over the standard width, then add "..." and stop adding any more lines
                    if (line.length != 1) {
                        if (lineNumber == 2) {
                            tspan.text(tspan.text().substring(0, tspan.text().length - 3) + "...");
                            break;
                        } else {
                            line.pop();
                            tspan.text(line.join(joinwith));
                            line = [word];
                            tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                        }
                    } else {
                        
                    }
                }

            }
        });
    }
    private Label_wraptext(text, standardwidth) {
        var width;
        text.each(function () {
            var text = d3.select(this),
                words = text.text().split(/\s+/).reverse(),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.1, 
                y = text.attr("y"),
                dy = parseFloat(text.attr("dy")),
                tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
            width = standardwidth * text.datum()["childrenCount"];

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));

                if (tspan.node().getComputedTextLength() > width) {

                    if (line.length == 1) {
                        var currline = line[0].split("");
                        while (tspan.node().getComputedTextLength() > width) {
                            currline.pop()
                            line[0] = currline.join("");
                            tspan.text(line[0]);
                        }
                    } else {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                        currline = tspan.text().split("");
                        while (tspan.node().getComputedTextLength() > width) {
                            currline.pop();
                            tspan.text(currline.join(""));
                        }
                    }
                }
            }
        });
    }
    private labelFitToWidth(text) {
        text.each(function (d, i, nodes) {
            if (i != 0) {
                var boundaryLable2 = nodes[i].getBoundingClientRect();
                var boundaryLable1 = nodes[i - 1].getBoundingClientRect();
                var overlap = !(boundaryLable1.right < boundaryLable2.left ||
                    boundaryLable1.left > boundaryLable2.right ||
                    boundaryLable1.bottom < boundaryLable2.top ||
                    boundaryLable1.top > boundaryLable2.bottom)
                if (overlap) {
                    nodes[i].remove();
                }
            }
        });
    }


    
    private createWaterfallGraphHorizontal(options, allData) {

       
        this.svg = this.container
            .append('svg');
        this.svgYAxis = this.container
            .append('svg');
        this.svg.on('contextmenu', () => {

            const mouseEvent: MouseEvent = d3.event as MouseEvent;
            const eventTarget: EventTarget = mouseEvent.target;
            let dataPoint: any = d3.select(<d3.BaseType>eventTarget).datum();
            this.selectionManager.showContextMenu(dataPoint ? dataPoint.selectionId : {}, {
                x: mouseEvent.clientX,
                y: mouseEvent.clientY
            });
            mouseEvent.preventDefault();
        });
        this.visualUpdateOptions = options;

        this.container.attr("width", this.width);
        this.container.attr("height", this.height);
        this.svg.attr("height", this.height);
        this.svgYAxis.attr("height", this.height);

        this.margin = {
            top: this.visualSettings.margins.topMargin + 20,
            right: this.visualSettings.margins.rightMargin,
            bottom: this.visualSettings.margins.bottomMargin + 5,
            left: this.visualSettings.margins.leftMargin
        };

        //reduce the innerwidth and height
        //adjust the margin of the div
        this.innerWidth = this.width - this.margin.left - this.margin.right;
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;

        this.adjustmentConstant = this.findXaxisAdjustment(this.barChartData);
        this.getMinMaxValue();

        this.gScrollable = this.svg.append('g');
        this.getYaxisHeightHorizontal(this.gScrollable);
        this.svg.attr("width", this.width);
        this.innerHeight = this.innerHeight - this.yAxisHeightHorizontal;
        this.svg.attr("height", this.innerHeight);
        this.checkBarWidthHorizontal(options);
        this.createXaxisHorizontal(this.gScrollable, options, allData);
        this.svgYAxis.attr("width", this.innerWidth);
        this.svgYAxis.attr("height", this.yAxisHeightHorizontal);
        
        this.createYAxisHorizontal(this.svgYAxis, 0);
        this.createYAxisHorizontal(this.gScrollable, this.innerHeight);
        
        this.createBarsHorizontal(this.gScrollable, this.barChartData);
        this.createLabelsHorizontal(this.gScrollable);
        this.svg.attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        this.svgYAxis.attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    }

    private createBarsHorizontal(gParent, data) {

        var g = gParent.append('g').attr('class', 'myBars');

        var xScale = d3.scaleBand()
            .domain(data.map(this.xValue))
            .range([0, this.innerHeight])
            .padding(0.2);

        this.bars = g.selectAll('rect').data(this.barChartData)
            .enter().append('rect')
            .attr('x', (d, i) => this.getXPositionHorizontal(d, i))
            .attr('y', d => xScale(d.category))
            .attr('width', (d, i) => this.getWidthHorizontal(d, i))
            .attr('height', xScale.bandwidth())
            .attr('fill', d => d.customBarColor);

        // Clear selection when clicking outside a bar
        this.svg.on('click', (d) => {
            if (this.host.allowInteractions) {
                this.selectionManager
                    .clear()
                    .then(() => {
                        this.selectionManager.registerOnSelectCallback(
                            (ids: ISelectionId[]) => {
                                this.syncSelectionState(this.bars, ids);
                            });
                    });
            }
            this.bars.attr('fill-opacity', 1);
        });

        //reset selections when the visual is re-drawn 
        this.syncSelectionState(
            this.bars,
            this.selectionManager.getSelectionIds() as ISelectionId[]
        );
        if (this.visualType == "drillable" || this.visualType == "staticCategory" || this.visualType == "drillableCategory") {
            this.bars.on('click', (d) => {
                // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)

                if (this.host.allowInteractions) {
                    const isCtrlPressed: boolean = (d3.event as MouseEvent).ctrlKey;
                    if (this.selectionManager.hasSelection() && !isCtrlPressed) {
                        this.bars.attr('fill-opacity', 1);
                    }
                    this.selectionManager
                        .select(d.selectionId, isCtrlPressed)
                        .then((ids: ISelectionId[]) => {
                            this.syncSelectionState(this.bars, ids);
                        });
                    (<Event>d3.event).stopPropagation();
                }
            });
        }

        this.tooltipServiceWrapper.addTooltip(g.selectAll('rect'),
            (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipData(tooltipEvent.data),
            (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipSelectionID(tooltipEvent.data));

        
        g.attr('transform', `translate(${-this.findRightHorizontal},${0})`);



    }
    private xBreakdownHorizontal(d, i) {
        var yBreakdownValue = 0;
        var startingPointCumulative = 0
        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerWidth + this.xAxisPosition - this.scrollbarBreath, 0]);

        //calculate the cumulative starting value        
        for (let index = 0; index < i; index++) {
            if (this.barChartData[index].isPillar == 1 || index == 0) {
                startingPointCumulative = this.yValue(this.barChartData[index]);
            } else {
                startingPointCumulative += this.yValue(this.barChartData[index]);
            }
        }

        //if the current breakdown is negative, reduce the value else do nothing. 
        if (this.yValue(d) < 0) {
            startingPointCumulative += Math.abs(this.yValue(d));
        }
        // no adjustment done for the main pillars

        if (d.isPillar == 1 || i == 0) {            
        } else {
            yBreakdownValue = yScale(this.minValue) - yScale(startingPointCumulative);
        }

        return yBreakdownValue;
    }
    private getXPositionHorizontal(d, i) {

        var Yposition = 0;

        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([0, this.innerWidth + this.xAxisPosition - this.scrollbarBreath])

        /* if ((d.isPillar == 1 || i == 0) && d.value < 0) {
            if (this.maxValue >= 0) {
                Yposition = yScale(0);      
            } else {
                Yposition = yScale(this.minValue);
            }
        } else {
            Yposition = this.xBreakdownHorizontal(d, i);
        } */

        if (d.isPillar == 1 || i == 0) {
            if (d.value > 0) {
                if (this.minValue < 0) {
                    Yposition = yScale(0)

                } /*else {
                    Yposition = yScale(0) - yScale(Math.abs(d.value) - this.minValue);
                }*/

            } else {
                if (this.maxValue >= 0) {
                    Yposition = yScale(0) - this.getWidthHorizontal(d, i);
                } /*else {
                    Yposition = yScale(0);
                }*/
            }
        } else if (d.value < 0) {
            Yposition = this.xBreakdownHorizontal(d, i) - this.getWidthHorizontal(d, i) * 2;
        } else {
            Yposition = this.xBreakdownHorizontal(d, i);
        }
        return Yposition;
    }
    private getWidthHorizontal(d, i) {
        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerWidth + this.xAxisPosition - this.scrollbarBreath, 0]);
        if (d.isPillar == 1 || i == 0) {
            if (d.value > 0) {
                if (this.minValue < 0) {
                    return yScale(0) - yScale(d.value);

                } else {
                    return yScale(0) - yScale(Math.abs(d.value) - this.minValue);

                }

            } else {
                if (this.maxValue >= 0) {
                    return yScale(d.value) - yScale(0);
                } else {
                    return yScale(d.value) - yScale(this.maxValue);
                }
            }
        } else {

            return yScale(0) - yScale(Math.abs(d.value));
        }
    }

    private createLabelsHorizontal(gParent) {

        var g = gParent.append('g').attr('class', 'myBarLabels');
        var yPositionWidth = (d, i, nodes) => {
            var yPosition
            var nodeID = i;
            var widthAdjustment = 0;
            pillarLabelsg.each((d, i, nodes) => {
                if (nodeID == i) {
                    
                    widthAdjustment = nodes[i].getBoundingClientRect().width;
                }
            })
            switch (d.customLabelPositioning) {
                case "Inside end":
                    yPosition = this.getXPositionHorizontal(d, i) + this.getWidthHorizontal(d, i) - widthAdjustment - 5;
                    break;
                case "Outside end":
                    if (d.value >= 0) {
                        yPosition = this.getXPositionHorizontal(d, i) + this.getWidthHorizontal(d, i) + 5;
                    } else {
                        yPosition = this.getXPositionHorizontal(d, i) - widthAdjustment - 5;
                    }
                    break;
                case "Inside center":
                    yPosition = (this.getXPositionHorizontal(d, i) + this.getWidthHorizontal(d, i) / 2 - widthAdjustment / 2);

                    break;
                case "Inside base":
                    yPosition = this.getXPositionHorizontal(d, i) + 5;
                    break;
                case "Outside top":
                    yPosition = this.getXPositionHorizontal(d, i) + this.getWidthHorizontal(d, i) + 5;
                    break;
                case "Inside bottom":
                    yPosition = this.getXPositionHorizontal(d, i) - widthAdjustment - 5;

            }


            return yPosition;
        }

        var yPositionHeight = (d, i, nodes) => {
            var yPosition
            var nodeID = i;
            var heightAdjustment = 0;
            pillarLabelsg.each((d, i, nodes) => {
                if (nodeID == i) {
                    
                    heightAdjustment = nodes[i].getBoundingClientRect().height;
                }
            })

            
            return xScale(d.category) + xScale.step() / 2;
        }
        var xScale = d3.scaleBand()
            .domain(this.barChartData.map(this.xValue))
            .range([0, this.innerHeight])
            .padding(0.2);
        if (this.visualSettings.LabelsFormatting.show) {


            var pillarLabelsg = g.selectAll('.labels')
                .data(this.barChartData)
                .enter().append('g');

            var pillarLabels = pillarLabelsg
                .append('text')
                .append('tspan')
                .attr('class', 'labels');

            var labelFormatting = d => {
                
                return this.formattedValuefromData(d);
            }

            var pillarLabelsText = pillarLabels
                .text(d => labelFormatting(d));




            pillarLabelsText.style('font-size', this.visualSettings.LabelsFormatting.fontSize)
                .style("font-family", this.visualSettings.LabelsFormatting.fontFamily)
                .style('fill', (d) => {
                    return d.customFontColor;
                });

            pillarLabelsg
                .attr('transform', (d, i, nodes) => `translate(${yPositionWidth(d, i, nodes)},${yPositionHeight(d, i, nodes)})`);

        }

        g.selectAll(".labels")
            .call(this.labelFitToWidthHorizontal, this.width + this.findRightHorizontal - this.margin.right);
        this.tooltipServiceWrapper.addTooltip(g.selectAll('.labels'),
            (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipData(tooltipEvent.data),
            (tooltipEvent: TooltipEventArgs<number>) => null);



        g.selectAll(".labels")
            .call(this.labelAlignmentHorizontal, xScale.bandwidth());
        
        g.attr('transform', `translate(${-this.findRightHorizontal},${0})`);



    }
    private labelFitToWidthHorizontal(text, rightEdge) {
        
        text.each(function (d, i, nodes) {

            if (nodes[i].getBoundingClientRect().right > rightEdge) {
                nodes[i].remove();
            }
        });
    }
    private labelAlignmentHorizontal(tspan, width) {
        return;
        tspan.each(function () {
            var tspan = d3.select(this);
            var tspanWidth = tspan.node().getComputedTextLength();
            var diff = (width - tspanWidth) / 2;
            tspan.attr('dy', diff);

        });
    }
    private checkBarWidthHorizontal(options) {

        if (!this.visualSettings.xAxisFormatting.fitToWidth) {
            this.visualUpdateOptions = options;

            var xScale = d3.scaleBand()
                .domain(this.barChartData.map(this.xValue))
                .range([0, this.innerHeight])
                .padding(0.2);

            var currentBarWidth = xScale.step();
            if (currentBarWidth < this.visualSettings.xAxisFormatting.barWidth) {
                currentBarWidth = this.visualSettings.xAxisFormatting.barWidth;
                

                var scrollBarGroup = this.svg.append('g');
                var scrollbarContainer = scrollBarGroup.append('rect')
                    .attr('width', this.scrollbarBreath)
                    .attr('height', this.innerHeight)
                    .attr('x', this.width - this.scrollbarBreath - this.margin.left)
                    .attr('y', 0)
                    .attr('fill', '#e1e1e1')
                    .attr('opacity', 0.5)
                    .attr('rx', 4)
                    .attr('ry', 4);
                var scrollBarGroupHeight = this.innerHeight
                this.innerHeight = currentBarWidth * this.barChartData.length
                    + (currentBarWidth * xScale.padding());

                
                var dragStartPosition = 0;
                var dragScrollBarXStartposition = 0;
                var dragStartPositionWheel = 0
                
                var scrollbarHeight = (scrollBarGroupHeight) * (scrollBarGroupHeight) / this.innerHeight;


                var scrollbar = scrollBarGroup.append('rect')
                    .attr('width', this.scrollbarBreath)
                    .attr('height', scrollbarHeight)
                    .attr('x', this.width - this.scrollbarBreath - this.margin.left)
                    .attr('y', 0)
                    .attr('fill', '#000')
                    .attr('opacity', 0.24)
                    .attr('rx', 4)
                    .attr('ry', 4);

                var scrollBarHorizontalDragBar = d3.drag()
                    .on("start", () => {
                        dragStartPosition = d3.event.y;
                        dragScrollBarXStartposition = parseInt(scrollbar.attr('y'));

                    })
                    .on("drag", () => {
                        var scrollBarMovement = d3.event.y - dragStartPosition;

                        //do not move the scroll bar beyond the x axis or after the end of the scroll bar
                        if (dragScrollBarXStartposition + scrollBarMovement >= 0 && (dragScrollBarXStartposition + scrollBarMovement + scrollbarHeight <= (this.height - this.margin.top - this.margin.bottom - this.yAxisHeightHorizontal))) {
                            scrollbar.attr('y', dragScrollBarXStartposition + scrollBarMovement);
                            this.gScrollable.attr('transform', `translate(${0},${(dragScrollBarXStartposition + scrollBarMovement) / (this.height - this.margin.top - this.margin.bottom - this.yAxisHeightHorizontal - scrollbarHeight) * (this.innerHeight - this.height + this.margin.top + this.margin.bottom + this.yAxisHeightHorizontal) * -1})`);
                        }
                    });

                var scrollBarHorizontalWheel = d3.zoom().on("zoom", () => {

                    var zoomScrollContainerheight = parseInt(scrollbarContainer.attr('height'));
                    var zoomScrollBarMovement = d3.event.sourceEvent.deltaY / 100 * zoomScrollContainerheight / this.barChartData.length;
                    var zoomScrollBarXStartposition = parseInt(scrollbar.attr('y'));
                    var zoomScrollBarheight = parseInt(scrollbar.attr('height'));

                    var scrollBarMovement = zoomScrollBarXStartposition + zoomScrollBarMovement;
                    if (scrollBarMovement < 0) {
                        scrollBarMovement = 0;
                    }
                    if (scrollBarMovement + zoomScrollBarheight > zoomScrollContainerheight) {
                        scrollBarMovement = zoomScrollContainerheight - zoomScrollBarheight
                    }
                    scrollbar.attr('y', scrollBarMovement);
                    this.gScrollable.attr('transform', `translate(${0},${(scrollBarMovement) / (this.height - this.margin.top - this.margin.bottom - this.yAxisHeightHorizontal - scrollbarHeight) * (this.innerHeight - this.height + this.margin.top + this.margin.bottom + this.yAxisHeightHorizontal) * -1})`);
                    


                });

                
                this.svg.call(scrollBarHorizontalWheel);
                scrollBarHorizontalDragBar(scrollbar);
            }
        }
    }
    private createXaxisHorizontal(gParent, options, allDatatemp) {
        var g = gParent.append('g').attr('class', 'xAxisParentGroup');

        var myAxisParentHeight = 0;
        var dataView = this.visualUpdateOptions.dataViews[0];
        var rows = dataView.matrix.rows;
        var root = rows.root;
        var levels = allDatatemp.length;        
        var xScale;
        var xBaseScale = d3.scaleBand()
            .domain(allDatatemp[allDatatemp.length - 1].map(this.xValue))
            .range([0, this.innerHeight])
            .padding(0.2);

        if (dataView.matrix.valueSources.length > 1) {
            var pillarsCount = 3;
            var fullWidth = this.innerHeight - xBaseScale.bandwidth() + (xBaseScale.step() * xBaseScale.padding() * pillarsCount);
            var myBandwidth = fullWidth / allDatatemp[allDatatemp.length - 1].length;
        } else {
            var pillarsCount = 2;
            var fullWidth = this.innerHeight - xBaseScale.bandwidth() - (xBaseScale.step() * xBaseScale.padding() * pillarsCount);
            var myBandwidth = fullWidth / (allDatatemp[allDatatemp.length - 1].length - 1);
        }

        for (var allDataIndex = levels - 1; allDataIndex >= 0; allDataIndex--) {
            var currData = [];

            if (allDataIndex == (levels - 1)) {
                xScale = xBaseScale;
                currData = allDatatemp[allDatatemp.length - 1];

            } else {

                currData = this.getAllMatrixLevelsNew(root, allDataIndex);
                var xAxisrange = [];
                var currChildCount = 0
                xAxisrange.push(0);
                currData.forEach(element => {
                    currChildCount = currChildCount + myBandwidth * element.childrenCount;
                    xAxisrange.push(currChildCount);
                });
                xScale = d3.scaleOrdinal()
                    .domain(currData.map((displayName, index) => index + displayName))
                    .range(xAxisrange);
            }
            this.findRightHorizontal = 0;
            var myWidth = currChildCount + myBandwidth;
            if (allDataIndex != (levels - 1)) {
                if (dataView.matrix.valueSources.length == 1) {
                    var myxAxisParent;
                    this.createAxisHorizontal(myxAxisParent, g, false, myWidth, 0, xScale, xBaseScale, currData, allDataIndex, levels, xAxisrange, myAxisParentHeight);
                } else {
                    for (let index = 1; index < dataView.matrix.valueSources.length; index++) {
                        var myxAxisParent;
                        this.createAxisHorizontal(myxAxisParent, g, false, myWidth, index, xScale, xBaseScale, currData, allDataIndex, levels, xAxisrange, myAxisParentHeight);
                    }
                }

            } else {
                var myxAxisParent;
                this.createAxisHorizontal(myxAxisParent, g, true, myWidth, 1, xScale, xBaseScale, currData, allDataIndex, levels, xAxisrange, myAxisParentHeight);
            }
            myAxisParentHeight = this.findRightHorizontal;
        }

        g.selectAll('text').each((d, i, nodes) => {

            if (this.xAxisPosition >= nodes[i].getBoundingClientRect().left) {
                this.xAxisPosition = nodes[i].getBoundingClientRect().left;
            };
        });
        
        this.findRightHorizontal = this.xAxisPosition;
        g.attr('transform', `translate(${this.xAxisPosition * -1},${0})`);

        
    }
    private findRightHorizontal;


    private createAxisHorizontal(myxAxisParent, g, baseAxis: boolean, myWidth, index: number, xScale, xBaseScale, currData, allDataIndex, levels, xAxisrange, myAxisParentHeight) {
        var myxAxisParentx = d3.axisLeft(xScale).tickSize(0);

        myxAxisParentx.tickSizeOuter(0);
        myxAxisParent = g.append('g')
            .style("font", this.visualSettings.xAxisFormatting.fontSize + "px times")
            .style("font-family", this.visualSettings.xAxisFormatting.fontFamily)
            .style("color", this.visualSettings.xAxisFormatting.fontColor)
            .attr('class', 'myXaxis')
            .call(myxAxisParentx);

        if (baseAxis) {
            myxAxisParent
                .attr('transform', `translate(${myAxisParentHeight}, 0)`)
                .selectAll('path').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor);
        } else if (index == 0) {
            myxAxisParent
                .attr('transform', `translate(${myAxisParentHeight - 5}, ${((xBaseScale.step() * xBaseScale.padding() * 0.5))})`)
                .selectAll('path').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor);
        } else {
            myxAxisParent
                .attr('transform', `translate(${myAxisParentHeight - 5}, ${(xBaseScale.bandwidth() + (xBaseScale.step() * xBaseScale.padding() * 1.5)) + myWidth * (index - 1)})`)
                .selectAll('path').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor);
        }

        var xAxislabels = myxAxisParent.selectAll(".tick text").data(currData).text(d => d.displayName);
        if (this.visualType == "drillable" || this.visualType == "staticCategory" || this.visualType == "drillableCategory") {
            xAxislabels.on('click', (d) => {
                // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)                
                if (this.host.allowInteractions) {
                    const isCtrlPressed: boolean = (d3.event as MouseEvent).ctrlKey;
                    if (this.selectionManager.hasSelection() && !isCtrlPressed) {
                        this.bars.attr('fill-opacity', 1);
                    }
                    this.selectionManager
                        .select(d.selectionId, isCtrlPressed)
                        .then((ids: ISelectionId[]) => {
                            this.syncSelectionState(this.bars, ids);
                        });
                    (<Event>d3.event).stopPropagation();
                }
            });
        }
        //tooltip for x-axis labels
        this.tooltipServiceWrapper.addTooltip(
            myxAxisParent.selectAll(".tick text"),
            (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipXaxis(tooltipEvent.data),
            (tooltipEvent: TooltipEventArgs<number>) => null
        );


        //move the labels of all secondary axis to the right as they don't have pillars

        if (allDataIndex != (levels - 1)) {
            if (this.visualSettings.xAxisFormatting.labelWrapText) {
                myxAxisParent.selectAll(".tick text")
                    .call(this.wrapHorizontal, xBaseScale.bandwidth());
            }

            myxAxisParent.selectAll(".tick text").data(currData)
                .attr('transform', (d, i) => `translate(${-this.visualSettings.xAxisFormatting.padding},${
                    (xAxisrange[i + 1] - xAxisrange[i]) / 2
                    })`);

            myxAxisParent.selectAll("line").remove();
        } else {
            if (this.visualSettings.xAxisFormatting.labelWrapText) {
                myxAxisParent.selectAll(".tick text")
                    .call(this.wrapHorizontal, xBaseScale.bandwidth());
            }
            xAxislabels.attr('transform', `translate(${-this.visualSettings.xAxisFormatting.padding},0)`);
        }

        myxAxisParent.selectAll("text").each((d, i, nodes) => {
            if (this.findRightHorizontal >= nodes[i].getBoundingClientRect().left) {
                this.findRightHorizontal = nodes[i].getBoundingClientRect().left;
            };
        });

        var maxtextWidth = 0;
        myxAxisParent.selectAll("text").each(function () {
            var text = d3.select(this);
            var textWidth = text.node().getBoundingClientRect().width;
            if (textWidth > maxtextWidth) {
                maxtextWidth = textWidth;
            }
        });
        myxAxisParent.selectAll("tspan")
            .call(this.xAxislabelAlignmentHorizontal, maxtextWidth);
        if (this.visualSettings.xAxisFormatting.showGridLine) {

            myxAxisParent.selectAll('path')
                .style('fill', 'none')
                .style('stroke', this.visualSettings.xAxisFormatting.gridLineColor)
                .style('stroke-width', this.defaultXAxisGridlineStrokeWidth() / 10 + "px");
            var myAxisTop = myxAxisParent.select("path").node().getBoundingClientRect().top

            myxAxisParent.selectAll(".text").data(currData)
                .enter()
                .append("line")
                .attr("y1", (d, i) => {
                    var x1;
                    if (allDataIndex == (levels - 1)) {
                        x1 = xScale(d.category) - (xScale.padding() * xScale.step()) / 2;
                    } else {                        
                        x1 = xAxisrange[i];
                    }
                    return x1;
                })
                .attr("x1", 0)
                .attr("y2", (d, i) => {
                    var x1;
                    if (allDataIndex == (levels - 1)) {
                        x1 = xScale(d.category) - (xScale.padding() * xScale.step()) / 2;
                    } else {
                        x1 = xAxisrange[i];;
                    }
                    return x1;
                })
                .attr("x2", this.findRightHorizontal - myAxisTop)
                .attr("stroke-width", (d, i) => this.lineWidth(d, i))
                .attr("stroke", this.visualSettings.xAxisFormatting.gridLineColor);
        } else {
            myxAxisParent.selectAll('path')
                .style('fill', 'none')
                .style('stroke', this.visualSettings.xAxisFormatting.gridLineColor)
                .style('stroke-width', "0px");
        }

    }
    private xAxislabelAlignmentHorizontal(tspan, width) {

        tspan.each(function () {
            var tspan = d3.select(this);
            var tspanWidth = tspan.node().getComputedTextLength();
            var diff = (tspanWidth - width) / 2;
            tspan.attr('dx', diff);

        });
    }
    private createYAxisHorizontal(gParent, adjustPosition) {
        var g = gParent.append('g').attr('class', 'yAxisParentGroup');
        


        //recreate yScale using the new values
        var yScale = d3.scaleLinear()
            .domain([this.maxValue, this.minValue])
            .range([this.innerWidth + this.xAxisPosition - this.scrollbarBreath 
                , 0]);

        

        var yAxisScale = d3.axisBottom(yScale).tickValues(this.yScaleTickValues);


        if (this.visualSettings.yAxisFormatting.show) {
            var yAxis = g.append('g')
                .style("font", this.visualSettings.yAxisFormatting.fontSize + "px times")
                .style("font-family", this.visualSettings.yAxisFormatting.fontFamily)
                .style("color", this.visualSettings.yAxisFormatting.fontColor)
                .attr('class', 'myYaxis');

            if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Auto") {
                yAxisScale.tickFormat(d => this.myFormat_Nodp(d).replace(/G/, "B"));


            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Thousands") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 100) / 10) + "k");
            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Millions") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 100000) / 10) + "M");
            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Billions") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 10000000) / 10) + "B");
            } else {
                yAxisScale.tickFormat(d => {
                    //y-axis formatting using the formatting of the first measure        
                    let iValueFormatter = valueFormatter.create({ format: this.barChartData[0].numberFormat });
                    return iValueFormatter.format(d);
                });
            }


            
            yAxis.call(yAxisScale);



            yAxis.selectAll('path').style('fill', 'none').style('stroke', 'black').style('stroke-width', "0px");
            if (this.visualSettings.yAxisFormatting.showGridLine) {
                yAxis.selectAll('line').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor).style('stroke-width', this.defaultYAxisGridlineStrokeWidth() / 10 + "px");
            } else {
                yAxis.selectAll('line').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor).style('stroke-width', "0px");
            }    
            yAxis.selectAll('line').attr('y2', -this.innerHeight);
        }

        g.attr('transform', `translate(${-this.findRightHorizontal},${adjustPosition})`);


    }
    private getYaxisHeightHorizontal(gParent) {

        var g = gParent.append('g').attr('class', 'yAxisParentGroup');
        var yScale = d3.scaleLinear()
            .domain([this.minValue, this.maxValue])
            .range([this.innerHeight, 0]);

        /*var ticksCount = 5;
        var staticYscaleTIcks = yScale.ticks(ticksCount);*/

        var yAxisScale = d3.axisBottom(yScale).tickValues(this.yScaleTickValues);

        if (this.visualSettings.yAxisFormatting.show) {
            var yAxis = g.append('g')
                .style("font", this.visualSettings.yAxisFormatting.fontSize + "px times")
                .style("font-family", this.visualSettings.yAxisFormatting.fontFamily)
                .style("color", this.visualSettings.yAxisFormatting.fontColor)
                .attr('class', 'myYaxis');

            if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Auto") {
                yAxisScale.tickFormat(d => this.myFormat_Nodp(d).replace(/G/, "B"));


            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Thousands") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 100) / 10) + "k");
            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Millions") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 100000) / 10) + "M");
            } else if (this.visualSettings.yAxisFormatting.YAxisValueFormatOption == "Billions") {
                yAxisScale.tickFormat((d: any) => this.myFormat_lessThanOne(Math.round(d / 10000000) / 10) + "B");
            } else {
                yAxisScale.tickFormat(d => {
                    //y-axis formatting using the formatting of the first measure        
                    let iValueFormatter = valueFormatter.create({ format: this.barChartData[0].numberFormat });
                    return iValueFormatter.format(d);
                });
            }


            
            yAxis.call(yAxisScale);



            yAxis.selectAll('path').style('fill', 'none').style('stroke', 'black').style('stroke-width', "0px");
            if (this.visualSettings.yAxisFormatting.showGridLine) {

                yAxis.selectAll('line').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor).style('stroke-width', this.defaultYAxisGridlineStrokeWidth() / 10 + "px");
            } else {
                yAxis.selectAll('line').style('fill', 'none').style('stroke', this.visualSettings.yAxisFormatting.gridLineColor).style('stroke-width', "0px");
            }

            // adjust the left margin of the chart area according to the width of yaxis             
            // yAxisWidth used to adjust the left margin
            this.yAxisHeightHorizontal = yAxis.node().getBoundingClientRect().height;
            
        }
        g.remove();
    }
    
    private wrapHorizontal(text, standardwidth) {

        var textHeight = text.node().getBoundingClientRect().height;
        var maxHeight = standardwidth * text.datum()["childrenCount"];
        var tspanAllowed = Math.floor(maxHeight / textHeight);

        text.each(function () {
            var text = d3.select(this),
                words = text.text().split(/\s+/).reverse(),
                wordsPerLine = Math.ceil(words.length / tspanAllowed),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.1, 
                y = text.attr("y"),
                dy = parseFloat(text.attr("dy")),
                tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");


            var counter = 0;
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                counter++;
                if (counter + 1 > wordsPerLine && words.length > 0) {
                    counter = 0;
                    line = [];
                    tspan.attr("y", -textHeight / 2);

                    tspan = text.append("tspan").attr("x", 0).attr("y", -textHeight / 2).attr("dy", ++lineNumber * lineHeight + dy + "em");
                }
            }
        });

    }
}