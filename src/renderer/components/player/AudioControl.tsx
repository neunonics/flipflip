import * as React from "react";
import Sound from "react-sound";
import clsx from "clsx";
import {remote} from "electron";
import fileURL from "file-url";
import * as mm from "music-metadata";
import { analyze } from 'web-audio-beat-detector';
import { readFileSync } from 'fs';
import Timeout = NodeJS.Timeout;
import {green, red} from "@material-ui/core/colors";

import {
  CircularProgress,
  Collapse, createStyles, Divider, FormControl, FormControlLabel, Grid, IconButton, InputAdornment, InputLabel,
  MenuItem, Select, Slider, SvgIcon, Switch, TextField, Theme, Tooltip, Typography, withStyles
} from "@material-ui/core";

import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import CheckIcon from '@material-ui/icons/Check';
import DeleteIcon from '@material-ui/icons/Delete';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import FolderIcon from '@material-ui/icons/Folder';
import Forward10Icon from '@material-ui/icons/Forward10';
import Replay10Icon from '@material-ui/icons/Replay10';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import VolumeDownIcon from '@material-ui/icons/VolumeDown';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';

import {getTimestamp, toArrayBuffer, urlToPath} from "../../data/utils";
import {SceneSettings} from "../../data/Config";
import {TF} from "../../data/const";
import en from "../../data/en";
import Audio from "../../data/Audio";
import Scene from "../../data/Scene";
import SoundTick from "./SoundTick";

const styles = (theme: Theme) => createStyles({
  fullWidth: {
    width: '100%',
  },
  noPadding: {
    padding: '0 !important',
  },
  endInput: {
    paddingLeft: theme.spacing(1),
    paddingTop: 0,
  },
  percentInput: {
    minWidth: theme.spacing(11),
  },
  bpmProgress: {
    position: 'absolute',
    right: 67,
  },
  tagProgress: {
    position: 'absolute',
    right: 20,
  },
  success: {
    backgroundColor: green[500],
    '&:hover': {
      backgroundColor: green[700],
    },
  },
  failure: {
    backgroundColor: red[500],
    '&:hover': {
      backgroundColor: red[700],
    },
  },
});

function getTimestampFromMs(ms: number): string {
  const secs = Math.floor(ms / 1000);
  return getTimestamp(secs);
}

class AudioControl extends React.Component {
  readonly props: {
    classes: any,
    audio: Audio,
    isFirst: boolean,
    scene: Scene,
    scenePaths: Array<any>,
    sidebar: boolean,
    startPlaying: boolean,
    onUpdateScene(scene: Scene | SceneSettings, fn: (scene: Scene | SceneSettings) => void): void,
    goBack?(): void,
    playNextScene?(): void,
  };

  readonly state = {
    playing: this.props.startPlaying,
    position: 0,
    duration: 0,
    tick: false,
    loadingBPM: false,
    successBPM: false,
    errorBPM: false,
    loadingTag: false,
    successTag: false,
    errorTag: false,
  };

  render() {
    const classes = this.props.classes;
    const audio = this.props.audio;
    const playing = this.state.playing
      ? (Sound as any).status.PLAYING
      : (Sound as any).status.PAUSED;

    const audioVolume = typeof audio.volume === 'number' ? audio.volume : 0;
    const audioSpeed = typeof audio.speed === 'number' ? audio.speed : 0;
    const tickSinRate = typeof audio.tickSinRate === 'number' ? audio.tickSinRate : 0;
    const tickBPMMulti = typeof audio.tickBPMMulti === 'number' ? audio.tickBPMMulti : 0;
    const tickDelay = typeof audio.tickDelay === 'number' ? audio.tickDelay : 0;
    const tickMinDelay = typeof audio.tickMinDelay === 'number' ? audio.tickMinDelay : 0;
    const tickMaxDelay = typeof audio.tickMaxDelay === 'number' ? audio.tickMaxDelay : 0;
    return(
      <React.Fragment key={audio.id}>
        {!this.props.isFirst && (
          <Grid item xs={12} className={clsx(!this.props.scene.audioEnabled && classes.noPadding)}>
            <Collapse in={this.props.scene.audioEnabled} className={classes.fullWidth}>
              <Divider/>
            </Collapse>
          </Grid>
        )}
        {this.props.scene.audioEnabled && (this.props.audio.tick && this.props.sidebar) && (
          <SoundTick
            url={this.props.audio.url}
            playing={playing}
            speed={this.props.audio.speed / 10}
            volume={this.props.audio.volume}
            tick={this.state.tick}
          />
        )}
        {this.props.scene.audioEnabled && (!this.props.audio.tick || !this.props.sidebar) && (
          <Sound
            url={this.props.audio.url}
            playStatus={playing}
            playbackRate={this.props.audio.speed / 10}
            loop={!this.props.audio.stopAtEnd && !this.props.audio.nextSceneAtEnd && this.props.sidebar}
            volume={this.props.audio.volume}
            position={this.state.position}
            onPlaying={this.onPlaying.bind(this)}
            onError={this.onError.bind(this)}
            onFinishedPlaying={this.onFinishedPlaying.bind(this)}
          />
        )}
        <Grid item xs={12} className={clsx(!this.props.scene.audioEnabled && classes.noPadding)}>
          <Collapse in={this.props.scene.audioEnabled} className={classes.fullWidth}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12}>
                <TextField
                  label="Audio URL"
                  fullWidth
                  placeholder="Paste URL Here"
                  margin="dense"
                  value={audio.url}
                  InputProps={{
                    endAdornment:
                      <InputAdornment position="end">
                        <Tooltip title="Open File">
                          <IconButton
                            onClick={this.onOpenFile.bind(this)}>
                            <FolderIcon/>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove Audio">
                          <IconButton
                            onClick={this.onDeleteAudioTrack.bind(this)}>
                            <DeleteIcon color="error"/>
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>,
                  }}
                  onChange={this.onAudioInput.bind(this, 'url')}/>
              </Grid>
              <Grid item xs={12}>
                <Grid container spacing={1} alignItems="center" justify="center">
                  <Grid item xs={12} sm={this.props.sidebar ? 12 : true}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item>
                        <Typography id="strobe-opacity-slider" variant="caption" component="div" color="textSecondary">
                          {getTimestampFromMs(this.state.position)}
                        </Typography>
                      </Grid>
                      <Grid item xs>
                        <Slider
                          value={this.state.position}
                          max={this.state.duration}
                          onChange={this.onChangePosition.bind(this)}/>
                      </Grid>
                      <Grid item>
                        <Typography id="strobe-opacity-slider" variant="caption" component="div" color="textSecondary">
                          {getTimestampFromMs(this.state.duration)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Grid>
                  <Grid item>
                    <Tooltip title="Jump Back">
                      <IconButton
                        onClick={this.onBack.bind(this)}>
                        <Replay10Icon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={this.state.playing ? "Pause" : "Play"}>
                      <IconButton
                        onClick={this.state.playing ? this.onPause.bind(this) : this.onPlay.bind(this)}>
                        {this.state.playing ? <PauseIcon/> : <PlayArrowIcon/>}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Jump Forward">
                      <IconButton
                        onClick={this.onForward.bind(this)}>
                        <Forward10Icon />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12}>
                <Grid container spacing={1} alignItems="center">
                  <Grid item>
                    <VolumeDownIcon />
                  </Grid>
                  <Grid item xs>
                    <Slider value={audioVolume}
                            onChange={this.onAudioSliderChange.bind(this, 'volume')}
                            aria-labelledby="audio-volume-slider" />
                  </Grid>
                  <Grid item>
                    <VolumeUpIcon />
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item>
                    <Collapse in={!audio.tick && !audio.nextSceneAtEnd}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={audio.stopAtEnd}
                            onChange={this.onAudioBoolInput.bind(this, 'stopAtEnd')}/>
                        }
                        label="Stop at End"/>
                    </Collapse>
                    <Collapse in={!audio.tick && !audio.stopAtEnd}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={audio.nextSceneAtEnd}
                            onChange={this.onAudioBoolInput.bind(this, 'nextSceneAtEnd')}/>
                        }
                        label="Next Scene at End"/>
                    </Collapse>
                    <Collapse in={!audio.stopAtEnd && !audio.nextSceneAtEnd}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={audio.tick}
                            onChange={this.onAudioBoolInput.bind(this, 'tick')}/>
                        }
                        label="Tick"/>
                    </Collapse>
                  </Grid>
                  <Divider component="div" orientation="vertical" style={{height: 48}}/>
                  <Grid item xs>
                    <Grid container>
                      {this.props.isFirst && (
                        <Grid item xs={12}>
                          <TextField
                            variant="outlined"
                            label="BPM"
                            margin="dense"
                            value={this.props.audio.bpm}
                            onChange={this.onAudioIntInput.bind(this, 'bpm')}
                            onBlur={this.blurAudioIntKey.bind(this, 'bpm')}
                            InputProps={{
                              endAdornment:
                                <InputAdornment position="end">
                                  <Tooltip title="Detect BPM">
                                    <IconButton
                                      className={clsx(this.state.successBPM && classes.success, this.state.errorBPM && classes.failure)}
                                      onClick={this.onDetectBPM.bind(this)}>
                                      {this.state.successBPM ? <CheckIcon/> :
                                        this.state.errorBPM ? <ErrorOutlineIcon/> :
                                        <SvgIcon viewBox="0 0 24 24" fontSize="small">
                                          <path
                                            d="M12,1.75L8.57,2.67L4.07,19.5C4.06,19.5 4,19.84 4,20C4,21.11 4.89,22 6,22H18C19.11,22 20,21.11 20,20C20,19.84 19.94,19.5 19.93,19.5L15.43,2.67L12,1.75M10.29,4H13.71L17.2,17H13V12H11V17H6.8L10.29,4M11,5V9H10V11H14V9H13V5H11Z"/>
                                        </SvgIcon>
                                      }
                                    </IconButton>
                                  </Tooltip>
                                  {this.state.loadingBPM && <CircularProgress size={34} className={classes.bpmProgress} />}
                                  <Tooltip title="Read BPM Metadata">
                                    <IconButton
                                      className={clsx(this.state.successTag && classes.success, this.state.errorTag && classes.failure)}
                                      onClick={this.onReadBPMTag.bind(this)}>
                                      {this.state.successTag ? <CheckIcon/> :
                                        this.state.errorTag ? <ErrorOutlineIcon/> :
                                          <AudiotrackIcon/>
                                      }
                                    </IconButton>
                                  </Tooltip>
                                  {this.state.loadingTag && <CircularProgress size={34} className={classes.tagProgress} />}
                                </InputAdornment>,
                            }}
                            inputProps={{
                              min: 0,
                              type: 'number',
                            }}/>
                        </Grid>
                      )}
                      <Grid item xs={12}>
                        <Typography id="audio-speed-slider" variant="caption" component="div"
                                    color="textSecondary">
                          Speed {audioSpeed / 10}x
                        </Typography>
                        <Slider
                          min={5}
                          max={40}
                          defaultValue={audioSpeed}
                          onChangeCommitted={this.onAudioSliderChange.bind(this, 'speed')}
                          valueLabelDisplay={'auto'}
                          valueLabelFormat={(v) => v/10 + "x"}
                          aria-labelledby="audio-speed-slider"/>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} className={clsx(!audio.tick && classes.noPadding)}>
                <Collapse in={audio.tick} className={classes.fullWidth}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={this.props.sidebar ? 12 : 4}>
                      <FormControl className={classes.fullWidth}>
                        <InputLabel>Timing</InputLabel>
                        <Select
                          value={audio.tickMode}
                          onChange={this.onAudioInput.bind(this, 'tickMode')}>
                          {Object.values(TF).map((tf) => {
                            if (tf != TF.bpm || !this.props.isFirst) {
                              return <MenuItem key={tf} value={tf}>{en.get(tf)}</MenuItem>;
                            } else return;
                          })}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={this.props.sidebar ? 12 : 8}>
                      <Collapse in={audio.tickMode == TF.sin} className={classes.fullWidth}>
                        <Typography id="tick-sin-rate-slider" variant="caption" component="div"
                                    color="textSecondary">
                          Wave Rate
                        </Typography>
                        <Grid container alignItems="center">
                          <Grid item xs>
                            <Slider
                              min={1}
                              defaultValue={tickSinRate}
                              onChangeCommitted={this.onAudioSliderChange.bind(this, 'tickSinRate')}
                              valueLabelDisplay={'auto'}
                              aria-labelledby="tick-sin-rate-slider"/>
                          </Grid>
                          <Grid item xs={3} className={classes.percentInput}>
                            <TextField
                              value={tickSinRate}
                              onChange={this.onAudioIntInput.bind(this, 'tickSinRate')}
                              onBlur={this.blurAudioIntKey.bind(this, 'tickSinRate')}
                              inputProps={{
                                className: classes.endInput,
                                step: 5,
                                min: 0,
                                max: 100,
                                type: 'number',
                                'aria-labelledby': 'tick-sin-rate-slider',
                              }}/>
                          </Grid>
                        </Grid>
                      </Collapse>
                      <Collapse in={audio.tickMode == TF.bpm} className={classes.fullWidth}>
                        <Typography id="tick-bpm-multi-slider" variant="caption" component="div"
                                    color="textSecondary">
                          BPM
                          Multiplier {audio.tickBPMMulti > 0 ? audio.tickBPMMulti : "1 / " + (-1 * (audio.tickBPMMulti - 2))}x
                        </Typography>
                        <Slider
                          min={-8}
                          max={10}
                          defaultValue={tickBPMMulti}
                          onChangeCommitted={this.onAudioSliderChange.bind(this, 'tickBPMMulti')}
                          valueLabelDisplay={'auto'}
                          valueLabelFormat={(v) => v > 0 ? v + "x" : "1/" + (-1 * (v - 2)) + "x"}
                          aria-labelledby="tick-bpm-multi-slider"/>
                      </Collapse>
                      <Collapse in={audio.tickMode == TF.constant} className={classes.fullWidth}>
                        <TextField
                          variant="outlined"
                          label="For"
                          margin="dense"
                          value={tickDelay}
                          onChange={this.onAudioIntInput.bind(this, 'tickDelay')}
                          onBlur={this.blurAudioIntKey.bind(this, 'tickDelay')}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                          }}
                          inputProps={{
                            step: 100,
                            min: 0,
                            type: 'number',
                          }}/>
                      </Collapse>
                    </Grid>
                  </Grid>
                </Collapse>
              </Grid>
              <Grid item xs={12} className={clsx(!audio.tick && classes.noPadding)}>
                <Collapse in={audio.tick && (audio.tickMode == TF.random || audio.tickMode == TF.sin)} className={classes.fullWidth}>
                  <Grid container alignItems="center">
                    <Grid item xs={12} sm={this.props.sidebar ? 12 : 6}>
                      <TextField
                        variant="outlined"
                        label="Between"
                        margin="dense"
                        value={tickMinDelay}
                        onChange={this.onAudioIntInput.bind(this, 'tickMinDelay')}
                        onBlur={this.blurAudioIntKey.bind(this, 'tickMinDelay')}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                        }}
                        inputProps={{
                          step: 100,
                          min: 0,
                          type: 'number',
                        }}/>
                    </Grid>
                    <Grid item xs={12} sm={this.props.sidebar ? 12 : 6}>
                      <TextField
                        variant="outlined"
                        label="and"
                        margin="dense"
                        value={tickMaxDelay}
                        onChange={this.onAudioIntInput.bind(this, 'tickMaxDelay')}
                        onBlur={this.blurAudioIntKey.bind(this, 'tickMaxDelay')}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                        }}
                        inputProps={{
                          step: 100,
                          min: 0,
                          type: 'number',
                        }}/>
                    </Grid>
                  </Grid>
                </Collapse>
              </Grid>
            </Grid>
          </Collapse>
        </Grid>
      </React.Fragment>
    );
  }

  _audio = "";
  _timeout: Timeout = null;
  componentDidMount() {
    this._audio=JSON.stringify(this.props.audio);
    if (this.props.startPlaying) {
      this.tickLoop(true);
    }
  }

  componentDidUpdate(props: any) {
    let audio = JSON.parse(this._audio);
    if ((this.props.audio.tick && !audio.tick) ||
      (this.props.audio.tick && audio.tickMode == TF.scene && this.props.audio.tickMode != TF.scene)){
      if (this.props.startPlaying) {
        this.tickLoop(true);
      }
    }
    if (this.props.audio.tick && this.props.audio.tickMode == TF.scene && props.scenePaths && props.scenePaths.length > 0 && props.scenePaths !== this.props.scenePaths) {
      this.setState({tick: !this.state.tick});
    }
    this._audio=JSON.stringify(this.props.audio);
  }

  componentWillUnmount() {
    if(this._timeout != null) {
      clearTimeout(this._timeout);
    }
  }

  onReadBPMTag() {
    if (this.props.audio.url && !this.state.loadingTag) {
      this.setState({loadingTag: true});
      mm.parseFile(urlToPath(this.props.audio.url))
        .then((metadata: any) => {
          if (metadata && metadata.common && metadata.common.bpm) {
            const newAudios = this.props.scene.audios;
            const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
            audio.bpm = metadata.common.bpm;
            this.changeKey('audios', newAudios);
            this.setState({loadingTag: false, successTag: true});
            setTimeout(() => {this.setState({successTag: false})}, 3000);
          } else {
            this.setState({loadingTag: false, errorTag: true});
            setTimeout(() => {this.setState({errorTag: false})}, 3000);
          }
        })
        .catch((err: any) => {
          console.error("Error reading metadata:", err.message);
          this.setState({loadingTag: false, errorTag: true});
          setTimeout(() => {this.setState({errorTag: false})}, 3000);
        });
    }
  }

  onDetectBPM() {
    if (this.props.audio.url && !this.state.loadingBPM) {
      this.setState({loadingBPM: true});
      try {
        let data = toArrayBuffer(readFileSync(urlToPath(this.props.audio.url)));
        let context = new AudioContext();
        context.decodeAudioData(data, (buffer) => {
          analyze(buffer)
            .then((tempo: number) => {
              const newAudios = this.props.scene.audios;
              const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
              audio.bpm = tempo.toFixed(2);
              this.changeKey('audios', newAudios);
              this.setState({loadingBPM: false, successBPM: true});
              setTimeout(() => {
                this.setState({successBPM: false})
              }, 3000);
            })
            .catch((err: any) => {
              console.error("Error analyzing");
              console.error(err);
              this.setState({loadingBPM: false, errorBPM: true});
              setTimeout(() => {
                this.setState({errorBPM: false})
              }, 3000);

            });
        }, (err) => {
          console.error(err);
          this.setState({loadingBPM: false, errorBPM: true});
          setTimeout(() => {
            this.setState({errorBPM: false})
          }, 3000);
        });
      } catch (e) {
        console.error(e);
        this.setState({loadingBPM: false, errorBPM: true});
        setTimeout(() => {
          this.setState({errorBPM: false})
        }, 3000);
      }
    }

  }

  tickLoop(starting: boolean = false) {
    if (!starting) {
      this.setState({tick: !this.state.tick});
    }
    if (this.props.audio.tick) {
      let timeout: number = null;
      switch (this.props.audio.tickMode) {
        case TF.random:
          timeout = Math.floor(Math.random() * (this.props.audio.tickMaxDelay - this.props.audio.tickMinDelay + 1)) + this.props.audio.tickMinDelay;
          break;
        case TF.sin:
          const sinRate = (Math.abs(this.props.audio.tickSinRate - 100) + 2) * 1000;
          timeout = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (this.props.audio.tickMaxDelay - this.props.audio.tickMinDelay + 1)) + this.props.audio.tickMinDelay;
          break;
        case TF.constant:
          timeout = this.props.audio.tickDelay;
          break;
        case TF.bpm:
          const bpmMulti = this.props.audio.tickBPMMulti > 0 ? this.props.audio.tickBPMMulti : 1 / (-1 * (this.props.audio.tickBPMMulti - 2));
          timeout = 60000 / (this.props.audio.bpm * bpmMulti);
          // If we cannot parse this, default to 1s
          if (!timeout) {
            timeout = 1000;
          }
          break;
      }
      if (timeout != null) {
        this._timeout = setTimeout(this.tickLoop.bind(this), timeout);
        return
      }
    }
    this._timeout = null;
  }

  onOpenFile() {
    let result = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {properties: ['openFile']});
    if (!result || !result.length) return;
    const newAudios = this.props.scene.audios;
    const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
    audio.url = fileURL(result[0]);
    this.changeKey('audios', newAudios);
  }

  onDeleteAudioTrack() {
    const newAudios = this.props.scene.audios;
    newAudios.splice(newAudios.map((a) => a.id).indexOf(this.props.audio.id), 1);
    this.changeKey('audios', newAudios);
  }

  onChangePosition(e: MouseEvent, value: number) {
    this.setState({position: value});
  }

  blurAudioIntKey(key: string, e: MouseEvent) {
    const min = (e.currentTarget as any).min ? (e.currentTarget as any).min : null;
    const max = (e.currentTarget as any).max ? (e.currentTarget as any).max : null;
    if (min && (this.props.scene as any)[key] < min) {
      const newAudios = this.props.scene.audios;
      const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
      audio[key] = min === '' ? '' : Number(min);
      this.changeKey('audios', newAudios);
    } else if (max && (this.props.scene as any)[key] > max) {
      const newAudios = this.props.scene.audios;
      const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
      audio[key] = max === '' ? '' : Number(max);
      this.changeKey('audios', newAudios);
    }
  }

  onAudioSliderChange(key: string, e: MouseEvent, value: number) {
    const newAudios = this.props.scene.audios;
    const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
    audio[key] = value;
    this.changeKey('audios', newAudios);
  }

  onAudioIntInput(key: string, e: MouseEvent) {
    const newAudios = this.props.scene.audios;
    const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
    const input = (e.target as HTMLInputElement);
    audio[key] = input.value === '' ? '' : Number(input.value);
    this.changeKey('audios', newAudios);
  }

  onAudioInput(key: string, e: MouseEvent) {
    const newAudios = this.props.scene.audios;
    const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
    const input = (e.target as HTMLInputElement);
    audio[key] = input.value;
    this.changeKey('audios', newAudios);
  }

  onAudioBoolInput(key: string, e: MouseEvent) {
    const newAudios = this.props.scene.audios;
    const audio: any = newAudios.find((a) => a.id == this.props.audio.id);
    const input = (e.target as HTMLInputElement);
    audio[key] = input.checked;
    if (key == 'tick' && input.checked) {
      audio.stopAtEnd = !input.checked;
      audio.nextSceneAtEnd = !input.checked;
    } else if (key == 'stopAtEnd' && input.checked) {
      audio.tick = !input.checked;
      audio.nextSceneAtEnd = !input.checked;
    } else if (key == 'nextSceneAtEnd' && input.checked) {
      audio.tick = !input.checked;
      audio.stopAtEnd = !input.checked;
    }
    this.changeKey('audios', newAudios);
  }

  changeKey(key: string, value: any) {
    this.update((s) => s[key] = value);
  }

  update(fn: (scene: any) => void) {
    this.props.onUpdateScene(this.props.scene, fn);
  }

  onFinishedPlaying() {
    if (this.props.audio.stopAtEnd && this.props.goBack) {
      this.props.goBack();
    }
    if (this.props.audio.nextSceneAtEnd && this.props.playNextScene) {
      this.props.playNextScene();
      this.setState({position: 0, duration: 0});
    }
    if (!this.props.sidebar) {
      this.setState({position: 0, playing: false});
    }
  }

  onPlaying(soundData: any) {
    let position = this.state.position;
    let duration = this.state.duration;
    if (soundData.position) {
      position = soundData.position;
    }
    if (soundData.duration) {
      duration = soundData.duration;
    }
    this.setState({position: position , duration: duration});
  }

  onError(errorCode: number, description: string) {
    console.error(errorCode + " - " + description);
  }

  onPlay() {
    this.setState({playing: true});
  }

  onPause() {
    this.setState({playing: false});
  }

  onBack() {
    let position = this.state.position - 10000;
    if (position < 0) {
      position = 0;
    }
    this.setState({position: position});
  }

  onForward() {
    let position = this.state.position + 10000;
    if (position > this.state.duration) {
      position = this.state.duration;
    }
    this.setState({position: position});
  }
}

export default withStyles(styles)(AudioControl as any);