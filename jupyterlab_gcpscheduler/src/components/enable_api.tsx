/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import { LearnMoreLink, SubmitButton, Message } from 'gcp_jupyterlab_shared';
import { GcpService } from '../service/gcp';
import { stylesheet } from 'typestyle';
import { ActionBar } from './action_bar';
import { OnSetupRequiredChange, OnDialogClose } from './dialog';

const LEARN_MORE_API = 'https://cloud.google.com/ai-platform/training/pricing';

interface Props {
  gcpService: GcpService;
  onDialogClose: OnDialogClose;
  onSetupRequiredChange: OnSetupRequiredChange;
}

interface State {
  error: string;
  isEnabling: boolean;
}

const localStyles = stylesheet({
  spacing: {
    margin: '24px',
  },
});

export class EnableApi extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: '',
      isEnabling: false,
    };
    this._enableAPI = this._enableAPI.bind(this);
    this._tryAgain = this._tryAgain.bind(this);
  }
  render() {
    return (
      <div className={localStyles.spacing}>
        <p>
          In order to use Notebook Executor, the{' '}
          <LearnMoreLink
            href={LEARN_MORE_API}
            text={'AI Platform Training API'}
          />{' '}
          must be enabled. This may incur additional charges. By clicking{' '}
          <i>continue</i>, you are agreeing to the terms of service for this
          API.
        </p>
        <ActionBar
          onDialogClose={this.props.onDialogClose}
          error={
            this.state.error ? (
              <Message
                asActivity={false}
                asError={true}
                text={this.state.error}
              />
            ) : null
          }
        >
          {this.state.error ? (
            <SubmitButton
              actionPending={this.state.isEnabling}
              onClick={this._tryAgain}
              text="Try Again"
            />
          ) : (
            <SubmitButton
              actionPending={this.state.isEnabling}
              onClick={this._enableAPI}
              text="Continue"
            />
          )}
        </ActionBar>
      </div>
    );
  }

  private async _tryAgain() {
    const isAPIEnabled = await this.props.gcpService.isTrainingAPIEnabled();
    if (isAPIEnabled) {
      this.props.onSetupRequiredChange(false);
    } else {
      this._enableAPI();
    }
  }

  private async _enableAPI() {
    this.setState({ isEnabling: true });
    const response = await this.props.gcpService.enableTrainingAPI();
    if (response.error) {
      this.setState({ error: response.error });
    } else {
      this.props.onSetupRequiredChange(false);
    }
    this.setState({ isEnabling: false });
  }
}
