import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';

import { REACT_APP_BUILD_DATE, REACT_APP_BUILD_HASH } from '~/config';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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

export const ViewBarBuildInfo = () => {
  if (
    !isNonEmptyString(REACT_APP_BUILD_HASH) ||
    !isNonEmptyString(REACT_APP_BUILD_DATE)
  ) {
    return null;
  }

  const shortHash = REACT_APP_BUILD_HASH.slice(0, 8);

  return (
    <StyledBuildInfo
      title={`${REACT_APP_BUILD_HASH} - ${REACT_APP_BUILD_DATE}`}
    >
      {shortHash} - {formatBuildDate(REACT_APP_BUILD_DATE)}
    </StyledBuildInfo>
  );
};
