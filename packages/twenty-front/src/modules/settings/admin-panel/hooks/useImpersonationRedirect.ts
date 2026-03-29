import { isMultiWorkspaceEnabledState } from '@/client-config/states/isMultiWorkspaceEnabledState';
import { useRedirectToWorkspaceDomain } from '@/domain-manager/hooks/useRedirectToWorkspaceDomain';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { AppPath } from 'twenty-shared/types';
import { type WorkspaceUrls } from '~/generated-metadata/graphql';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';

export const useImpersonationRedirect = () => {
  const isMultiWorkspaceEnabled = useAtomStateValue(
    isMultiWorkspaceEnabledState,
  );
  const { redirectToWorkspaceDomain } = useRedirectToWorkspaceDomain();

  const executeImpersonationRedirect = async (
    workspaceUrls: WorkspaceUrls,
    loginToken: string,
    target: string = '_self',
  ) => {
    if (!isMultiWorkspaceEnabled) {
      const baseUrl = getWorkspaceUrl(workspaceUrls) ?? window.location.origin;
      const url = new URL(AppPath.Verify, baseUrl);
      url.searchParams.set('loginToken', loginToken);
      window.open(url.toString(), target);
      return;
    }

    return await redirectToWorkspaceDomain(
      getWorkspaceUrl(workspaceUrls),
      AppPath.Verify,
      { loginToken },
      target,
    );
  };

  return { executeImpersonationRedirect };
};
