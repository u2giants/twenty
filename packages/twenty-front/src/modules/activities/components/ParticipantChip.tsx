import { styled } from '@linaria/react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { getDisplayNameFromParticipant } from '@/activities/emails/utils/getDisplayNameFromParticipant';
import { getLinkToShowPage } from '@/object-metadata/utils/getLinkToShowPage';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { RecordChip } from '@/object-record/components/RecordChip';
import { Avatar, IconArrowUpRight } from 'twenty-ui/display';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledAvatarContainer = styled.span`
  margin-right: ${themeCssVariables.spacing[1]};
`;

const StyledSenderName = styled.span<{ variant?: 'default' | 'bold' }>`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${({ variant }) =>
    variant === 'bold'
      ? themeCssVariables.font.weight.medium
      : themeCssVariables.font.weight.regular};
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledContainer = styled.div`
  align-items: flex-start;
  display: flex;
`;

const StyledChip = styled.div`
  align-items: center;
  box-sizing: border-box;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  height: 20px;
  padding: ${themeCssVariables.spacing[1]};
  white-space: nowrap;
`;

const StyledContextMenuPortal = styled.div<{ x: number; y: number }>`
  left: ${({ x }) => x}px;
  position: fixed;
  top: ${({ y }) => y}px;
  z-index: 9999;
`;

type ParticipantChipVariant = 'default' | 'bold';

export const ParticipantChip = ({
  participant,
  variant = 'default',
  className,
}: {
  participant: any;
  variant?: ParticipantChipVariant;
  className?: string;
}) => {
  const { person, workspaceMember } = participant;
  const navigate = useNavigate();
  const [contextMenuPos, setContextMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = getDisplayNameFromParticipant({
    participant,
    shouldUseFullName: true,
  });

  const avatarUrl = person?.avatarUrl ?? workspaceMember?.avatarUrl ?? '';

  useEffect(() => {
    if (!contextMenuPos) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenuPos]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleOpenRecord = () => {
    setContextMenuPos(null);
    navigate(getLinkToShowPage(CoreObjectNameSingular.Person, person));
  };

  return (
    <StyledContainer className={className}>
      {person ? (
        <div onContextMenu={handleContextMenu}>
          <RecordChip
            objectNameSingular={CoreObjectNameSingular.Person}
            record={person}
            isBold={variant === 'bold'}
          />
          {contextMenuPos ? (
            <>
              {createPortal(
                <StyledContextMenuPortal
                  x={contextMenuPos.x}
                  y={contextMenuPos.y}
                >
                  <div ref={menuRef}>
                    <DropdownContent widthInPixels={180}>
                      <DropdownMenuItemsContainer>
                        <MenuItem
                          LeftIcon={IconArrowUpRight}
                          text="Open People record"
                          onClick={handleOpenRecord}
                        />
                      </DropdownMenuItemsContainer>
                    </DropdownContent>
                  </div>
                </StyledContextMenuPortal>,
                document.body,
              )}
            </>
          ) : null}
        </div>
      ) : (
        <StyledChip>
          <StyledAvatarContainer>
            <Avatar
              avatarUrl={avatarUrl}
              type="rounded"
              placeholder={displayName}
              size="sm"
            />
          </StyledAvatarContainer>
          <StyledSenderName variant={variant}>{displayName}</StyledSenderName>
        </StyledChip>
      )}
    </StyledContainer>
  );
};
