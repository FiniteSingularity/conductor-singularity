type CloneInteractionStep = StepBlurFace | StepChalkboardWrite | StepEnd;

export interface StepBlurFace {
  stepType: "blur";
  startTime: number;
  blur: number;
  duration: number;
}

export interface StepChalkboardWrite {
  stepType: "chalkboard-write";
  startTime: number;
  text: string;
  duration: number;
}

export interface StepEnd {
  stepType: "end";
  endTime: number;
}

export interface CloneInteractionInstance {
  filePath: string;
  steps: Array<CloneInteractionStep>;
}

export interface CloneInteractionBackground {
  bgType: "image" | "video";
  filePath: string;
}

export interface CloneInteraction {
  sceneName: string;
  cloneSourceName: string;
  bgImageSourceName: string;
  bgVideoSourceName: string;
  backgrounds: CloneInteractionBackground[];
  finite: CloneInteractionInstance[];
  roscodes: CloneInteractionInstance[];
}
