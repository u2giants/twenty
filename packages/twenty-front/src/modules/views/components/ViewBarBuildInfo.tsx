import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useState } from 'react';

import { REACT_APP_BUILD_DATE, REACT_APP_BUILD_HASH } from '~/config';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const BUILD_INFO_FALLBACK_URL =
  'https://api.github.com/repos/u2giants/twenty/commits/main';

type BuildInfo = {
  hash: string;
  date: string;
};

const StyledBuildInfo = styled.div`
  align-items: center;
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  height: 24px;
  max-width: 260px;
  padding: 0 ${themeCssVariables.spacing[2]};
  white-space: nowrap;
`;

const formatBuildDate = (buildDate: string) => {
  const parsedDate = new Date(buildDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return buildDate;
  }

  return parsedDate.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getBuildInfoFromEnv = (): BuildInfo | null => {
  if (
    !isNonEmptyString(REACT_APP_BUILD_HASH) ||
    !isNonEmptyString(REACT_APP_BUILD_DATE)
  ) {
    return null;
  }

  return {
    hash: REACT_APP_BUILD_HASH,
    date: REACT_APP_BUILD_DATE,
  };
};

export const ViewBarBuildInfo = () => {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(
    getBuildInfoFromEnv,
  );

  useEffect(() => {
    if (buildInfo !== null) {
      return;
    }

    let isMounted = true;

    const fetchBuildInfo = async () => {
      const response = await fetch(BUILD_INFO_FALLBACK_URL);
      const commit = await response.json();
      const hash = commit?.sha;
      const date =
        commit?.commit?.committer?.date ?? commit?.commit?.author?.date;

      if (isMounted && isNonEmptyString(hash) && isNonEmptyString(date)) {
        setBuildInfo({ hash, date });
      }
    };

    void fetchBuildInfo().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [buildInfo]);

  if (buildInfo === null) {
    return null;
  }

  const shortHash = buildInfo.hash.slice(0, 8);

  return (
    <StyledBuildInfo title={`${buildInfo.hash} - ${buildInfo.date}`}>
      {shortHash} - {formatBuildDate(buildInfo.date)}
    </StyledBuildInfo>
  );
};
