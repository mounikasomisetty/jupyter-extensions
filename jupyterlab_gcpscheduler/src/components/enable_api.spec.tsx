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

import { shallow } from 'enzyme';
import * as React from 'react';
import { EnableApi } from './enable_api';
import { GcpService } from '../service/gcp';
import { SubmitButton } from 'gcp_jupyterlab_shared';
import { immediatePromise } from '../test_helpers';

describe('EnableAPI', () => {
  const mockOnDialogClose = jest.fn();
  const mockOnSetupRequiredChange = jest.fn();
  const mockIsApiEnabled = jest.fn();
  const mockEnableAPI = jest.fn();
  const mockGcpService = ({
    isTrainingAPIEnabled: mockIsApiEnabled,
    enableTrainingAPI: mockEnableAPI,
  } as unknown) as GcpService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Renders enable api message', () => {
    const component = shallow(
      <EnableApi
        gcpService={mockGcpService}
        onDialogClose={mockOnDialogClose}
        onSetupRequiredChange={mockOnSetupRequiredChange}
      />
    );
    expect(component).toMatchSnapshot();
  });

  it('Enables API on continue', async () => {
    const resolvedEnableAPI = Promise.resolve({});
    mockEnableAPI.mockResolvedValue(resolvedEnableAPI);
    const component = shallow(
      <EnableApi
        gcpService={mockGcpService}
        onDialogClose={mockOnDialogClose}
        onSetupRequiredChange={mockOnSetupRequiredChange}
      />
    );
    component.find(SubmitButton).simulate('click');
    await immediatePromise();
    await resolvedEnableAPI;
    expect(mockEnableAPI).toHaveBeenCalled();
    expect(mockOnSetupRequiredChange).toHaveBeenCalled();
  });

  it('Throws error on continue', async () => {
    const resolvedEnableAPI = Promise.resolve({
      error: 'Oops... an error occurred',
    });
    mockEnableAPI.mockResolvedValue(resolvedEnableAPI);
    const component = shallow(
      <EnableApi
        gcpService={mockGcpService}
        onDialogClose={mockOnDialogClose}
        onSetupRequiredChange={mockOnSetupRequiredChange}
      />
    );
    component.find(SubmitButton).simulate('click');
    await immediatePromise();
    await resolvedEnableAPI;
    expect(mockEnableAPI).toHaveBeenCalled();
    expect(mockOnSetupRequiredChange).not.toHaveBeenCalled();
    await immediatePromise();
    expect(component.html()).toContain('Oops... an error occurred');
  });

  it('Throws error on continue and try again', async () => {
    const resolvedEnableAPIError = Promise.resolve({
      error: 'Oops... an error occurred',
    });
    const resolvedIsAPIEnabled = Promise.resolve(false);
    const resolvedEnableAPI = Promise.resolve({});
    mockIsApiEnabled.mockReturnValue(resolvedIsAPIEnabled);
    mockEnableAPI
      .mockReturnValueOnce(resolvedEnableAPIError)
      .mockReturnValueOnce(resolvedEnableAPI);
    const component = shallow(
      <EnableApi
        gcpService={mockGcpService}
        onDialogClose={mockOnDialogClose}
        onSetupRequiredChange={mockOnSetupRequiredChange}
      />
    );
    component.find(SubmitButton).simulate('click');
    await immediatePromise();
    await resolvedEnableAPIError;
    expect(mockEnableAPI).toHaveBeenCalled();
    expect(mockOnSetupRequiredChange).not.toHaveBeenCalled();
    await immediatePromise();
    expect(component.html()).toContain('Oops... an error occurred');
    //try again
    component.find(SubmitButton).simulate('click');
    await immediatePromise();
    await resolvedIsAPIEnabled;
    await resolvedEnableAPI;
    expect(mockIsApiEnabled).toHaveBeenCalled();
    expect(mockEnableAPI).toHaveBeenCalled();
    expect(mockOnSetupRequiredChange).toHaveBeenCalled();
  });
});
