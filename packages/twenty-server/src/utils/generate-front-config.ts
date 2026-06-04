import * as fs from 'fs';
import * as path from 'path';

import { config } from 'dotenv';
config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  override: true,
});

const getFirstNonEmptyEnvValue = (names: string[]): string | undefined => {
  const matchingName = names.find((name) => {
    const value = process.env[name];

    return typeof value === 'string' && value.trim() !== '';
  });

  return matchingName ? process.env[matchingName] : undefined;
};

export function generateFrontConfig(): void {
  const configObject = {
    window: {
      _env_: {
        REACT_APP_SERVER_BASE_URL: process.env.SERVER_URL,
        REACT_APP_BUILD_HASH: getFirstNonEmptyEnvValue([
          'REACT_APP_BUILD_HASH',
          'SOURCE_COMMIT',
          'SOURCE_COMMIT_SHA',
          'COOLIFY_GIT_COMMIT_SHA',
          'GITHUB_SHA',
          'COMMIT_SHA',
        ]),
        REACT_APP_BUILD_DATE: getFirstNonEmptyEnvValue([
          'REACT_APP_BUILD_DATE',
          'SOURCE_COMMIT_TIMESTAMP',
          'COOLIFY_DEPLOYMENT_CREATED_AT',
          'GITHUB_EVENT_HEAD_COMMIT_TIMESTAMP',
          'COMMIT_DATE',
        ]),
      },
    },
  };

  const configString = `<!-- BEGIN: Twenty Config -->
    <script id="twenty-env-config">
      window._env_ = ${JSON.stringify(configObject.window._env_, null, 2)};
    </script>
    <!-- END: Twenty Config -->`;

  const distPath = path.join(__dirname, '..', 'front');
  const indexPath = path.join(distPath, 'index.html');

  try {
    let indexContent = fs.readFileSync(indexPath, 'utf8');

    indexContent = indexContent.replace(
      /<!-- BEGIN: Twenty Config -->[\s\S]*?<!-- END: Twenty Config -->/,
      configString,
    );

    fs.writeFileSync(indexPath, indexContent, 'utf8');
  } catch {
    // oxlint-disable-next-line no-console
    console.log(
      'Frontend build not found or not writable, assuming it is served independently',
    );
  }
}
