import React from 'react';
import {Composition} from 'remotion';
import {GuardTest, FPS, DURATION} from './GuardTest';
import {CrisisShort} from './short/Short';
import {TOTAL} from './short/data';
import {KitDemo} from './kit/KitDemo';
import {CharacterTest, CT_FPS, CT_FRAMES} from './CharacterTest';
import {ExpressionSheet, SHEET_H, SHEET_W} from './kit/ExpressionSheet';
import {CrisisShortV2} from './v2/CrisisV2';
import {LimbTest, LT_FPS, LT_FRAMES} from './LimbTest';
import {KitTest6, KT6_FPS, KT6_FRAMES} from './KitTest6';
import {TrollTest3, TT3_FPS, TT3_FRAMES} from './TrollTest3';
import {WalkTest, WT_FPS, WT_FRAMES} from './WalkTest';
import {HeadSheet, HS_W, HS_H} from './HeadSheet';
import {LooksTest, LK_FPS, LK_FRAMES} from './LooksTest';
import {CobraEffect, CE_FPS, CE_FRAMES} from './CobraEffect';
import {CobraQASheet1, CobraQASheet2, CobraQASheet3} from './CobraQASheet';
import {ChunkRender, CR_FPS, CR_FRAMES} from './kit/ChunkRender';
import {ChunkSelfTest, CST_FRAMES} from './kit/ChunkSelfTest';
import {ShoppingCart, SC_FPS, SC_FRAMES} from './ShoppingCart';
import {ShoppingCartStoryboard, ShoppingCartStoryboardGrid, SB_FPS, SB_FRAMES, GRID_W as SG_W, GRID_H as SG_H} from './ShoppingCartStoryboard';
import {ShoppingCartQASheet1, ShoppingCartQASheet2, ShoppingCartQASheet3, ShoppingCartQASheet4} from './ShoppingCartQASheet';
import {OverboardSurvivor, OS_FPS, OS_FRAMES} from './OverboardSurvivor';
import {OverboardSurvivorHeliSheet, GRID_W as OHS_W, GRID_H as OHS_H} from './OverboardSurvivorHeliSheet';
import {OverboardSurvivorStoryboard, OverboardSurvivorStoryboardGrid, SB_FPS as OSB_FPS, SB_FRAMES as OSB_FRAMES, GRID_W as OSG_W, GRID_H as OSG_H} from './OverboardSurvivorStoryboard';
import {OverboardSurvivorQASheet1, OverboardSurvivorQASheet2, OverboardSurvivorQASheet3, OverboardSurvivorQASheet4, OverboardSurvivorQASheet5, OverboardSurvivorQASheet6, OverboardSurvivorQASheet7, OverboardSurvivorQASheet8} from './OverboardSurvivorQASheet';
import {ZumbisParte10, ZP_FPS, ZP_FRAMES} from './ZumbisParte10';
import {ZumbisParte10Storyboard, ZumbisParte10StoryboardGrid, SB_FPS as ZSB_FPS, SB_FRAMES as ZSB_FRAMES, GRID_W as ZG_W, GRID_H as ZG_H} from './ZumbisParte10Storyboard';
import {ZumbisParte10QASheet1, ZumbisParte10QASheet2, ZumbisParte10QASheet3, ZumbisParte10QASheet4, ZumbisParte10QASheet5} from './ZumbisParte10QASheet';
import {JointSheet} from './JointSheet';
import {HeadMotionSheet} from './HeadMotionSheet';
import {HeadTurnaroundSheet1, HeadTurnaroundSheet2, HeadTurnaroundSheet3, HeadTurnaroundSheet4, HeadTurnaroundSheet5} from './HeadTurnaroundSheet';
import {CobraStoryboard, CobraStoryboardGrid, CS_FPS, CS_FRAMES, GRID_W, GRID_H} from './CobraStoryboard';

export const Root: React.FC = () => (
  <>
    <Composition id="CrisisShort" component={CrisisShort} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{audio: true}} />
    {/* same video without the audio track: use this one for client-side (browser) renders */}
    <Composition id="CrisisShortSilent" component={CrisisShort} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{audio: false}} />
    <Composition id="CrisisShortV2" component={CrisisShortV2} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{audio: true}} />
    {/* V2 without the audio track, for client-side (browser) renders */}
    <Composition id="CrisisShortV2Silent" component={CrisisShortV2} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{audio: false}} />
    <Composition id="KitDemo" component={KitDemo} durationInFrames={90} fps={30} width={1080} height={1920} />
    <Composition id="CharacterTest" component={CharacterTest} durationInFrames={CT_FRAMES} fps={CT_FPS} width={1080} height={1920} />
    <Composition id="ExpressionSheet" component={ExpressionSheet} durationInFrames={30} fps={30} width={SHEET_W} height={SHEET_H} />
    <Composition id="LimbTest" component={LimbTest} durationInFrames={LT_FRAMES} fps={LT_FPS} width={1080} height={1920} />
    <Composition id="KitTest6" component={KitTest6} durationInFrames={KT6_FRAMES} fps={KT6_FPS} width={1080} height={1920} />
    {/* same video for client-side (browser) renders; the test has no audio at all */}
    <Composition id="KitTest6Silent" component={KitTest6} durationInFrames={KT6_FRAMES} fps={KT6_FPS} width={1080} height={1920} />
    <Composition id="TrollTest3" component={TrollTest3} durationInFrames={TT3_FRAMES} fps={TT3_FPS} width={1080} height={1920} />
    {/* same test for client-side (browser) renders; it has no audio at all */}
    <Composition id="TrollTest3Silent" component={TrollTest3} durationInFrames={TT3_FRAMES} fps={TT3_FPS} width={1080} height={1920} />
    <Composition id="WalkTest" component={WalkTest} durationInFrames={WT_FRAMES} fps={WT_FPS} width={1080} height={1920} />
    {/* same test for client-side (browser) renders; it has no audio at all */}
    <Composition id="WalkTestSilent" component={WalkTest} durationInFrames={WT_FRAMES} fps={WT_FPS} width={1080} height={1920} />
    <Composition id="LooksTest" component={LooksTest} durationInFrames={LK_FRAMES} fps={LK_FPS} width={1080} height={1920} />
    <Composition id="HeadSheet" component={HeadSheet} durationInFrames={30} fps={30} width={HS_W} height={HS_H} />
    {/* COBRA_EFFECT phase 1: 15 static storyboard stills (15 frames each) and the contact sheet; Studio only, no render */}
    <Composition id="CobraStoryboard" component={CobraStoryboard} durationInFrames={CS_FRAMES} fps={CS_FPS} width={1080} height={1920} />
    <Composition id="CobraStoryboardGrid" component={CobraStoryboardGrid} durationInFrames={30} fps={CS_FPS} width={GRID_W} height={GRID_H} />
    {/* COBRA_EFFECT phase 2: the full video. Render CobraEffectSilent (client-side, 300-frame chunks); audio is in COBRA_EFFECT/ */}
    {/* QA contact sheets (Studio only): 5 shots x 5 frames each, with the focus centre and framing box drawn on top */}
    <Composition id="CobraQASheet1" component={CobraQASheet1} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="CobraQASheet2" component={CobraQASheet2} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="CobraQASheet3" component={CobraQASheet3} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="CobraEffect" component={CobraEffect} durationInFrames={CE_FRAMES} fps={CE_FPS} width={1080} height={1920} />
    <Composition id="CobraEffectSilent" component={CobraEffect} durationInFrames={CE_FRAMES} fps={CE_FPS} width={1080} height={1920} />
    {/* KIT TOOL: automatic resumable chunked client-side render. Open Studio at /chunk-render (see STYLE_NOTES.md, CHUNK RENDER TOOL). ChunkSelfTest is a 70-frame 2D test clip for it. */}
    <Composition id="chunk-render" component={ChunkRender} durationInFrames={CR_FRAMES} fps={CR_FPS} width={1080} height={1920} />
    <Composition id="ChunkSelfTest" component={ChunkSelfTest} durationInFrames={CST_FRAMES} fps={30} width={270} height={480} />
    {/* SHOPPING_CART: storyboard stills, contact sheet, QA sheets, the video (render ShoppingCartSilent in 300-frame chunks) */}
    <Composition id="ShoppingCartStoryboard" component={ShoppingCartStoryboard} durationInFrames={SB_FRAMES} fps={SB_FPS} width={1080} height={1920} />
    <Composition id="ShoppingCartStoryboardGrid" component={ShoppingCartStoryboardGrid} durationInFrames={30} fps={SB_FPS} width={SG_W} height={SG_H} />
    <Composition id="ShoppingCartQASheet1" component={ShoppingCartQASheet1} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="ShoppingCartQASheet2" component={ShoppingCartQASheet2} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="ShoppingCartQASheet3" component={ShoppingCartQASheet3} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="ShoppingCartQASheet4" component={ShoppingCartQASheet4} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="ShoppingCart" component={ShoppingCart} durationInFrames={SC_FRAMES} fps={SC_FPS} width={1080} height={1920} />
    <Composition id="ShoppingCartSilent" component={ShoppingCart} durationInFrames={SC_FRAMES} fps={SC_FPS} width={1080} height={1920} />
    {/* OVERBOARD_SURVIVOR: storyboard stills, contact sheet, QA sheets, the video (render OverboardSurvivorSilent in 300-frame chunks) */}
    <Composition id="OverboardSurvivorStoryboard" component={OverboardSurvivorStoryboard} durationInFrames={OSB_FRAMES} fps={OSB_FPS} width={1080} height={1920} />
    <Composition id="OverboardSurvivorStoryboardGrid" component={OverboardSurvivorStoryboardGrid} durationInFrames={30} fps={OSB_FPS} width={OSG_W} height={OSG_H} />
    <Composition id="OverboardSurvivorQASheet1" component={OverboardSurvivorQASheet1} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="OverboardSurvivorQASheet2" component={OverboardSurvivorQASheet2} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="OverboardSurvivorQASheet3" component={OverboardSurvivorQASheet3} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="OverboardSurvivorQASheet4" component={OverboardSurvivorQASheet4} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="OverboardSurvivorQASheet5" component={OverboardSurvivorQASheet5} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="OverboardSurvivorQASheet6" component={OverboardSurvivorQASheet6} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="OverboardSurvivorQASheet7" component={OverboardSurvivorQASheet7} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="OverboardSurvivorQASheet8" component={OverboardSurvivorQASheet8} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="OverboardSurvivor" component={OverboardSurvivor} durationInFrames={OS_FRAMES} fps={OS_FPS} width={1080} height={1920} />
    <Composition id="OverboardSurvivorHeliSheet" component={OverboardSurvivorHeliSheet} durationInFrames={30} fps={30} width={OHS_W} height={OHS_H} />
    <Composition id="OverboardSurvivorSilent" component={OverboardSurvivor} durationInFrames={OS_FRAMES} fps={OS_FPS} width={1080} height={1920} />
    {/* ZUMBIS_PARTE_10 (channel FocoProibido). Remotion ids cannot contain underscores: ZumbisParte10Silent is the composition to render (folder ZUMBIS_PARTE_10) */}
    <Composition id="ZumbisParte10Storyboard" component={ZumbisParte10Storyboard} durationInFrames={ZSB_FRAMES} fps={ZSB_FPS} width={1080} height={1920} />
    <Composition id="ZumbisParte10StoryboardGrid" component={ZumbisParte10StoryboardGrid} durationInFrames={30} fps={ZSB_FPS} width={ZG_W} height={ZG_H} />
    {[ZumbisParte10QASheet1, ZumbisParte10QASheet2, ZumbisParte10QASheet3, ZumbisParte10QASheet4, ZumbisParte10QASheet5].map((C, i) => <Composition key={i} id={`ZumbisParte10QASheet${i + 1}`} component={C} durationInFrames={30} fps={30} width={1080} height={1920} />)}
    <Composition id="ZumbisParte10" component={ZumbisParte10} durationInFrames={ZP_FRAMES} fps={ZP_FPS} width={1080} height={1920} />
    <Composition id="ZumbisParte10Silent" component={ZumbisParte10} durationInFrames={ZP_FRAMES} fps={ZP_FPS} width={1080} height={1920} />
    {/* KIT QA: head turnaround sheets (8 yaws x 6 characters per sheet, 3D gear on) */}
    <Composition id="HeadMotionSheet" component={HeadMotionSheet} durationInFrames={30} fps={30} width={1080} height={1920} />
    {[HeadTurnaroundSheet1, HeadTurnaroundSheet2, HeadTurnaroundSheet3, HeadTurnaroundSheet4, HeadTurnaroundSheet5].map((C, i) => <Composition key={i} id={`HeadTurnaroundSheet${i + 1}`} component={C} durationInFrames={30} fps={30} width={1080} height={1920} />)}
    <Composition id="JointSheet" component={JointSheet} durationInFrames={30} fps={30} width={1080} height={1920} />
    <Composition id="GuardTest"component={GuardTest} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
  </>
);
