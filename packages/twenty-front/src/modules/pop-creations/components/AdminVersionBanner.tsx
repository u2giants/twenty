import { currentUserState } from '@/auth/states/currentUserState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const BUILD_HASH: string = process.env.REACT_APP_BUILD_HASH ?? '';
const BUILD_DATE: string = process.env.REACT_APP_BUILD_DATE ?? '';

const formatBuildDate = (iso: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const StyledVersionBar = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.tertiary};
  font-family: monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
  padding: 2px 12px;
  text-align: right;
  user-select: text;
  width: 100%;
  box-sizing: border-box;
`;

export const AdminVersionBanner = () => {
  const currentUser = useAtomStateValue(currentUserState);

  if (!currentUser?.canAccessFullAdminPanel) {
    return null;
  }

  const hash = BUILD_HASH ? BUILD_HASH.slice(0, 8) : 'dev';
  const date = BUILD_DATE ? formatBuildDate(BUILD_DATE) : 'local';

  return (
    <StyledVersionBar title={`Full commit: ${BUILD_HASH || 'unknown'}`}>
      {hash} · {date}
    </StyledVersionBar>
  );
};
