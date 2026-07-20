import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { SessionStateService } from '../state/session-state.service';

/**
 * Structural directive `*kfHasPermission="'api_key:create'"`
 * Conditionally renders an element based on whether the current user in the selected organization
 * has permission to perform the specified action.
 */
@Directive({
  selector: '[kfHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly sessionState = inject(SessionStateService);

  private hasView = false;
  private permissionValue: string | null = null;

  @Input() set kfHasPermission(permission: string) {
    this.permissionValue = permission;
    this.updateView();
  }

  constructor() {
    effect(() => {
      // Re-evaluate when organization or user session state changes
      this.sessionState.currentOrganization();
      this.updateView();
    });
  }

  private updateView(): void {
    const org = this.sessionState.currentOrganization();
    // OWNER, ADMIN, and MEMBER roles in an org have access to key management & analytics
    const hasAccess = !!org && ['OWNER', 'ADMIN', 'MEMBER'].includes(org.currentUserRole);

    if (hasAccess && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasAccess && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
