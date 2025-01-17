import globals from './globals.js';
import { mxgraph } from './mxgraph-initializer';

import { FitType, ShapeBpmnElementKind } from 'bpmn-visualization';
import { frequencyScale } from './colors.js'
import { getFrequencyOverlay } from './overlays.js';
import { colorLegend, overlayLegend } from './legend.js';
import { getBpmnActivityElementbyName } from './utils.js';

export function getBPMNDiagram(formData) {
    console.log('Get bpmn...');
    return fetch('http://localhost:6969/discover/inductive-miner', {
            method: 'POST',
            body: formData
        }).then(response => response.text())
          .then(data => visualizeBPMN(data))
          .catch(error => console.log(error))
}

function visualizeBPMN(data) {
    console.log("BPMN data received!")
    //load
    globals.bpmnVisualization.load(data, {
        fit: { type: FitType.Center }
    });

    //update the list of bpmn activities
    globals.bpmnActivityElements = globals.bpmnVisualization.bpmnElementsRegistry.getElementsByKinds(ShapeBpmnElementKind.TASK)
    computeFrequency()
}

function computeFrequency(){
    console.log('Compute frequency stats...');
    fetch('http://localhost:6969/stats/frequency')
            .then(response => response.json())
            .then(data => visualizeFrequency(data))
            .catch(error => console.log(error))
}

function visualizeFrequency(data) {
    console.log("Frequency stats received!")

    //set the frequency color scale
    const values = Object.values(data);
    const max = Math.max(...values);
    const avg = max/2;
    const myFrequencyScale = frequencyScale(0, max)

    //change activity style through mxGraph
    /**
     * A high level API will be provided: see https://github.com/process-analytics/bpmn-visualization-R/issues/13
     */
    let mxGraph = globals.bpmnVisualization.graph
    let activityCurrentStyle = null
    let activityCell = null

    //iterate over the activites and set their color by calling the frequency color scale function
    for (const [activityName, freqValue] of Object.entries(data)) {
        const activityElement = getBpmnActivityElementbyName(activityName)
        if(activityElement){
            activityCell = mxGraph.getModel().getCell(activityElement.bpmnSemantic.id)
            //activityCurrentStyle = mxGraph.getCurrentCellStyle(activityCell)
            activityCurrentStyle = mxGraph.getModel().getStyle(activityCell)
            
            mxGraph.getModel().beginUpdate()
            try { 
                let style = mxgraph.mxUtils.setStyle(activityCurrentStyle, 'fillColor', myFrequencyScale(freqValue))
				mxGraph.getModel().setStyle(activityCell, style);
                activityCurrentStyle = mxGraph.getModel().getStyle(activityCell)
                //different ways of setting the style
                //mxGraph.setCellStyles("fillColor", myFrequencyScale(freqValue), [activityCell]);
                //or
                //mxGraph.setCellStyles(mxgraph.mxConstants.STYLE_FILLCOLOR, 'red', [activityCell]); 

                //set label to white when the activity fillColor is above the scale average
                if (freqValue > avg){
                    style = mxgraph.mxUtils.setStyle(activityCurrentStyle, 'fontColor', 'white')
				    mxGraph.getModel().setStyle(activityCell, style);
                    //different way of setting the style
                    //mxGraph.setCellStyles("fontColor", "white", [activityCell]); 
                }
            } finally {
                mxGraph.getModel().endUpdate();
            }

            //add frequency overlay
            globals.bpmnVisualization.bpmnElementsRegistry.addOverlays(
                activityElement.bpmnSemantic.id,
                getFrequencyOverlay(freqValue, max, 
                                    myFrequencyScale(freqValue)))
        }    
    }

    //add legend
    colorLegend({
        colorScale: myFrequencyScale,
        title: "Frequency of execution"
    }) 
    
    overlayLegend({rightOverlayLegend : "# executions"})
}