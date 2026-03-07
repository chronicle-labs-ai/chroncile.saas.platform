use axum::Json;

use chronicle_auth::types::AuthUser;
use chronicle_domain::FeatureAccessResponse;

use super::error::ApiResult;
use crate::feature_access::ResolvedFeatureAccess;

pub async fn get_feature_access(
    _user: AuthUser,
    access: ResolvedFeatureAccess,
) -> ApiResult<Json<FeatureAccessResponse>> {
    Ok(Json(FeatureAccessResponse { access: access.0 }))
}
